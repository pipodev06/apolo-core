import * as logger from "firebase-functions/logger";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

// Mismo sentinel que src/pages/tickets/TicketDetail.tsx (IA_CREATED_BY): tickets
// creados de forma automática no tienen un usuario real al que notificar.
const IA_CREATED_BY = "ia-assistant";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_proceso: "En Proceso",
  terminado: "Terminado",
};

// Mismos labels que src/components/tickets/UrgencyBadge.tsx.
const URGENCY_LABELS: Record<string, string> = {
  CRITICO: "Crítico",
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
};

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

// Escribe en tickets/{id}/eventos un registro automático cada vez que cambia
// el estado o la asignación de un ticket (por IA o manual). No notifica
// directamente: eso lo centraliza `notificarEvento` sobre la subcolección.
export const registrarCambiosTicket = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const db = getFirestore();
  const eventosRef = db.collection("tickets").doc(event.params.ticketId).collection("eventos");
  const escrituras: Promise<unknown>[] = [];

  if (before.status !== after.status) {
    const label = STATUS_LABELS[after.status as string] ?? after.status;
    escrituras.push(
      eventosRef.add({
        tipo: "sistema",
        mensaje: `Estado cambiado a ${label}`,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  }

  if (before.urgency !== after.urgency) {
    const label = URGENCY_LABELS[after.urgency as string] ?? after.urgency;
    escrituras.push(
      eventosRef.add({
        tipo: "sistema",
        mensaje: `Urgencia cambiada a ${label}`,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  }

  if (before.assignedTo !== after.assignedTo) {
    let mensaje = "Asignación removida";
    if (after.assignedTo) {
      const empleadoDoc = await db.collection("personal").doc(after.assignedTo as string).get();
      const nombre = (empleadoDoc.data()?.nombre as string | undefined) ?? "un empleado";
      mensaje = `Asignado a ${nombre}`;
    }
    escrituras.push(
      eventosRef.add({
        tipo: "sistema",
        mensaje,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  }

  await Promise.all(escrituras);
});

// Punto único de notificación: dispara tanto para eventos automáticos
// (registrarCambiosTicket) como para comentarios manuales del cliente.
export const notificarEvento = onDocumentCreated(
  "tickets/{ticketId}/eventos/{eventoId}",
  async (event) => {
    const evento = event.data?.data();
    if (!evento) return;

    const db = getFirestore();
    const ticketId = event.params.ticketId;
    const ticketDoc = await db.collection("tickets").doc(ticketId).get();
    if (!ticketDoc.exists) return;

    const ticket = ticketDoc.data()!;
    const createdBy = ticket.createdBy as string | undefined;
    if (!createdBy || createdBy === IA_CREATED_BY) return;
    if (evento.tipo === "comentario" && evento.actorId === createdBy) return;

    const mensaje =
      evento.tipo === "comentario"
        ? `${evento.actorNombre || "Alguien"} comentó: "${truncar(evento.texto ?? "", 120)}"`
        : (evento.mensaje as string);

    await db.collection("notificaciones").add({
      userId: createdBy,
      ticketId,
      ticketCode: ticket.code,
      mensaje,
      leida: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Notificación creada para usuario ${createdBy} sobre ticket ${ticket.code}`);
  }
);

// Días de retención tras marcarse como leída, antes de que el TTL policy de
// Firestore (campo "expiraEn", configurado en la consola/gcloud, no en este
// código) la borre automáticamente. El cliente solo puede tocar "leida"
// (firestore.rules), por eso "expiraEn" se setea acá, no en notificacionesService.
const DIAS_RETENCION_LEIDAS = 7;

export const expirarNotificacionLeida = onDocumentUpdated("notificaciones/{notifId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.leida === true || after.leida !== true) return;

  const expiraEn = Timestamp.fromMillis(Date.now() + DIAS_RETENCION_LEIDAS * 24 * 60 * 60 * 1000);
  await event.data!.after.ref.update({ expiraEn });
});
