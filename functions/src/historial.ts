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

  if (before.solutionDescription !== after.solutionDescription && after.solutionDescription) {
    escrituras.push(
      eventosRef.add({
        tipo: "sistema",
        mensaje: "Solución agregada",
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
        // clave: permite a notificarEvento avisar al técnico solo de su asignación.
        clave: "asignacion",
        mensaje,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  }

  await Promise.all(escrituras);
});

type Db = FirebaseFirestore.Firestore;

// Notificación in-app + (si config/app.emailHabilitado) correo. El correo se
// encola en la colección `mail`, formato de la extensión oficial "Trigger
// Email from Firestore" (firebase/firestore-send-email), que es la que lo
// envía vía SMTP — sin la extensión instalada, no se encola nada.
async function notificar(
  db: Db,
  userIds: Iterable<string>,
  ticketId: string,
  ticketCode: string,
  mensaje: string
) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const emailHabilitado = (await db.collection("config").doc("app").get()).data()?.emailHabilitado === true;

  await Promise.all(
    ids.map(async (userId) => {
      await db.collection("notificaciones").add({
        userId,
        ticketId,
        ticketCode,
        mensaje,
        leida: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (!emailHabilitado) return;
      const email = (await db.collection("users").doc(userId).get()).data()?.email as string | undefined;
      if (!email) return;
      await db.collection("mail").add({
        to: email,
        message: {
          subject: `[${ticketCode}] ${truncar(mensaje, 80)}`,
          text: `${mensaje}

Ticket: ${ticketCode}
Ingresa a Apolo Core para ver el detalle.`,
        },
      });
    })
  );
  logger.info(`Notificación de ${ticketCode} enviada a ${ids.length} usuario(s)`);
}

// Cuentas (users) vinculadas a un empleado de personal/ — el técnico asignado.
async function usuariosDeEmpleado(db: Db, personalId: string | undefined): Promise<string[]> {
  if (!personalId) return [];
  const snap = await db.collection("users").where("personalId", "==", personalId).where("active", "==", true).get();
  return snap.docs.filter((d) => !d.data().deletedAt).map((d) => d.id);
}

// Punto único de notificación sobre eventos de un ticket (automáticos de
// registrarCambiosTicket y comentarios del cliente):
//   • el creador recibe todo;
//   • el técnico asignado recibe comentarios y su asignación (no los cambios
//     de estado, que normalmente hace él mismo).
// Nadie se notifica a sí mismo por su propio comentario.
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

    const destinatarios: string[] = [];
    const createdBy = ticket.createdBy as string | undefined;
    if (createdBy && createdBy !== IA_CREATED_BY) destinatarios.push(createdBy);
    if (evento.tipo === "comentario" || evento.clave === "asignacion") {
      destinatarios.push(...(await usuariosDeEmpleado(db, ticket.assignedTo as string | undefined)));
    }

    const mensaje =
      evento.tipo === "comentario"
        ? `${evento.actorNombre || "Alguien"} comentó: "${truncar(evento.texto ?? "", 120)}"`
        : (evento.mensaje as string);

    await notificar(
      db,
      destinatarios.filter((id) => !(evento.tipo === "comentario" && id === evento.actorId)),
      ticketId,
      ticket.code as string,
      mensaje
    );
  }
);

// Ticket nuevo: avisa a los admins activos (quien lo creó no se avisa a sí mismo).
export const notificarTicketNuevo = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const ticket = event.data?.data();
  if (!ticket) return;
  const db = getFirestore();
  const admins = await db.collection("users").where("role", "in", ["admin", "super_admin"]).where("active", "==", true).get();
  const ids = admins.docs.filter((d) => !d.data().deletedAt && d.id !== ticket.createdBy).map((d) => d.id);
  await notificar(db, ids, event.params.ticketId, ticket.code as string, `Nuevo ticket: ${truncar(ticket.title ?? "", 100)}`);
});

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
