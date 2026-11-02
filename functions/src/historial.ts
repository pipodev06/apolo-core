import { FieldValue } from "firebase-admin/firestore";

// Historial y notificaciones de los cambios que hace la IA. Los cambios de
// usuarios los escribe el cliente en el mismo batch que el ticket
// (src/services/historialService.ts); acá queda solo lo del lado servidor.

// Mismo sentinel que src/lib/historial.ts: tickets sin usuario real detrás.
const IA_CREATED_BY = "ia-assistant";
const ACTOR_IA = { actorTipo: "ia", actorNombre: "Asistente IA" };

// Mismos labels que src/lib/ticketStatus.ts.
const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_proceso: "En Proceso",
  terminado: "Terminado",
};
const URGENCY_LABELS: Record<string, string> = {
  CRITICO: "Crítico",
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
};

type Db = FirebaseFirestore.Firestore;
type Datos = FirebaseFirestore.DocumentData;

async function usuariosDeEmpleado(db: Db, personalId: unknown): Promise<string[]> {
  if (typeof personalId !== "string" || !personalId) return [];
  const snap = await db.collection("users").where("personalId", "==", personalId).get();
  return snap.docs.filter((d) => d.data().active === true && !d.data().deletedAt).map((d) => d.id);
}

// Escribe en un batch los eventos (y notificaciones) de lo que cambió la IA
// en el ticket: misma forma que los del cliente, en el mismo orden.
export async function registrarCambiosIA(
  db: Db,
  ticketId: string,
  antes: Datos,
  update: Datos,
  nombreAsignado?: string
) {
  const cambios: { mensaje: string; clave?: string }[] = [];
  if (update.assignedTo && update.assignedTo !== antes.assignedTo) {
    const nuevo = nombreAsignado ?? "un empleado";
    let mensaje = `Asignado a ${nuevo}`;
    if (antes.assignedTo) {
      const anterior = (await db.collection("personal").doc(antes.assignedTo).get()).data()?.nombre;
      mensaje = `Reasignado de ${anterior ?? "un empleado eliminado"} a ${nuevo}`;
    }
    cambios.push({ mensaje, clave: "asignacion" });
  }
  if (update.status && update.status !== antes.status) {
    cambios.push({ mensaje: `Estado: ${STATUS_LABELS[antes.status] ?? antes.status} → ${STATUS_LABELS[update.status]}` });
  }
  if (update.urgency && update.urgency !== antes.urgency) {
    cambios.push({ mensaje: `Urgencia: ${URGENCY_LABELS[antes.urgency] ?? antes.urgency} → ${URGENCY_LABELS[update.urgency]}` });
  }
  if (update.categoria && update.categoria !== antes.categoria) {
    cambios.push({ mensaje: `Categoría: ${update.categoria}` });
  }
  if (cambios.length === 0) return;

  const creador = antes.createdBy && antes.createdBy !== IA_CREATED_BY ? [antes.createdBy as string] : [];
  const tecnicos = cambios.some((c) => c.clave === "asignacion") ? await usuariosDeEmpleado(db, update.assignedTo) : [];

  const batch = db.batch();
  const eventos = db.collection("tickets").doc(ticketId).collection("eventos");
  cambios.forEach((cambio, orden) => {
    batch.set(eventos.doc(), {
      tipo: "sistema",
      ...cambio,
      ...ACTOR_IA,
      orden,
      createdAt: FieldValue.serverTimestamp(),
    });
    const destinatarios = new Set(cambio.clave === "asignacion" ? [...creador, ...tecnicos] : creador);
    for (const userId of destinatarios) {
      batch.set(db.collection("notificaciones").doc(), {
        userId,
        ticketId,
        ticketCode: antes.code,
        mensaje: `${cambio.mensaje} (por ${ACTOR_IA.actorNombre})`,
        leida: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
  await batch.commit();
}
