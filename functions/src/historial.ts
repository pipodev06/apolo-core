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

// Quién hizo ESTE cambio: la firma `modificadoPor` que escriben el cliente
// (usuario) y la IA. Solo cuenta si cambió en esta misma escritura (su `en`
// es un serverTimestamp nuevo en cada update); si no, sería la firma de un
// cambio anterior y se atribuiría mal.
function actorDelCambio(
  before: FirebaseFirestore.DocumentData,
  after: FirebaseFirestore.DocumentData
): { actorNombre: string; actorTipo: string; actorId?: string } | null {
  const firma = after.modificadoPor as { tipo?: string; id?: string; nombre?: string; en?: Timestamp } | undefined;
  if (!firma?.nombre || !firma.en) return null;
  const previa = before.modificadoPor as { en?: Timestamp } | undefined;
  if (previa?.en && previa.en.isEqual(firma.en)) return null;
  return {
    actorNombre: firma.nombre,
    actorTipo: firma.tipo === "ia" ? "ia" : "usuario",
    ...(firma.id ? { actorId: firma.id } : {}),
  };
}

async function nombreEmpleado(db: FirebaseFirestore.Firestore, id: unknown): Promise<string> {
  if (typeof id !== "string" || !id) return "un empleado";
  const doc = await db.collection("personal").doc(id).get();
  return (doc.data()?.nombre as string | undefined) ?? "un empleado eliminado";
}

// Escribe en tickets/{id}/eventos un registro automático cada vez que cambia
// el estado, la urgencia, la categoría o la asignación de un ticket (por IA
// o manual), con quién lo hizo. No notifica directamente: eso lo centraliza
// `notificarEvento` sobre la subcolección.
export const registrarCambiosTicket = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const db = getFirestore();
  const eventosRef = db.collection("tickets").doc(event.params.ticketId).collection("eventos");
  const actor = actorDelCambio(before, after) ?? {};
  const registrar = (mensaje: string, extra: Record<string, unknown> = {}) =>
    eventosRef.add({ tipo: "sistema", mensaje, ...actor, ...extra, createdAt: FieldValue.serverTimestamp() });
  // Mensajes en el orden en que se escriben (ver el final de la función).
  const mensajes: [string, Record<string, unknown>?][] = [];

  // Asignación primero: al reasignar, el cambio de estado que la acompaña
  // (p. ej. en_proceso → asignado) se lee como consecuencia de ella.
  if (before.assignedTo !== after.assignedTo) {
    let mensaje: string;
    if (!after.assignedTo) {
      mensaje = `Asignación removida (estaba asignado a ${await nombreEmpleado(db, before.assignedTo)})`;
    } else if (before.assignedTo) {
      const [anterior, nuevo] = await Promise.all([
        nombreEmpleado(db, before.assignedTo),
        nombreEmpleado(db, after.assignedTo),
      ]);
      mensaje = `Reasignado de ${anterior} a ${nuevo}`;
    } else {
      mensaje = `Asignado a ${await nombreEmpleado(db, after.assignedTo)}`;
    }
    // clave: permite a notificarEvento avisar al técnico solo de su asignación.
    mensajes.push([mensaje, { clave: "asignacion" }]);
  }

  if (before.status !== after.status) {
    const de = STATUS_LABELS[before.status as string] ?? before.status;
    const a = STATUS_LABELS[after.status as string] ?? after.status;
    mensajes.push([`Estado: ${de} → ${a}`]);
  }

  if (before.urgency !== after.urgency) {
    const de = URGENCY_LABELS[before.urgency as string] ?? before.urgency;
    const a = URGENCY_LABELS[after.urgency as string] ?? after.urgency;
    mensajes.push([`Urgencia: ${de} → ${a}`]);
  }

  if ((before.categoria ?? "") !== (after.categoria ?? "")) {
    mensajes.push([after.categoria ? `Categoría: ${after.categoria}` : "Categoría quitada"]);
  }

  if (before.solutionDescription !== after.solutionDescription && after.solutionDescription) {
    mensajes.push(["Solución agregada"]);
  }

  // Secuencial: así el orden en el historial es el de arriba (los
  // serverTimestamp de escrituras en paralelo pueden quedar invertidos).
  for (const [mensaje, extra] of mensajes) await registrar(mensaje, extra);
});

type Db = FirebaseFirestore.Firestore;

// Notificación in-app a cada destinatario (sin duplicados).
async function notificar(
  db: Db,
  userIds: Iterable<string>,
  ticketId: string,
  ticketCode: string,
  mensaje: string
) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;

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
        : evento.actorNombre
          ? `${evento.mensaje as string} (por ${evento.actorNombre})`
          : (evento.mensaje as string);

    await notificar(
      db,
      // Nadie se notifica a sí mismo por su propio comentario o cambio.
      destinatarios.filter((id) => id !== evento.actorId),
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
