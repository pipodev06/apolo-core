import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../firebase";
import { ROLES_ADMIN } from "../lib/roles";

// Historial y notificaciones se escriben desde el cliente en la MISMA
// escritura (batch o transacción) que el ticket o el comentario que los
// origina: las reglas solo los aceptan así (ver eventos y notificaciones en
// firestore.rules). Antes lo hacían triggers de Cloud Functions.

// Lo que tienen en común WriteBatch y Transaction para escribir.
interface Escritor {
  set(ref: DocumentReference<DocumentData>, data: DocumentData): unknown;
}

// Cuentas activas vinculadas a un empleado de personal/ (el técnico asignado).
export async function usuariosDeEmpleado(personalId: string | undefined): Promise<string[]> {
  if (!personalId) return [];
  const snap = await getDocs(query(collection(db, "users"), where("personalId", "==", personalId)));
  return snap.docs.filter((d) => d.data().active === true && !d.data().deletedAt).map((d) => d.id);
}

export async function adminsActivos(): Promise<string[]> {
  const snap = await getDocs(query(collection(db, "users"), where("role", "in", ROLES_ADMIN)));
  return snap.docs.filter((d) => d.data().active === true && !d.data().deletedAt).map((d) => d.id);
}

// Nombres de empleados por id, para los mensajes de asignación.
export async function nombresDeEmpleados(ids: (string | undefined)[]) {
  const unicos = [...new Set(ids.filter((id): id is string => !!id))];
  const nombres = new Map<string, string>();
  await Promise.all(
    unicos.map(async (id) => {
      const nombre = (await getDoc(doc(db, "personal", id))).data()?.nombre;
      nombres.set(id, typeof nombre === "string" ? nombre : "un empleado eliminado");
    })
  );
  return (id: string | undefined) => (id ? (nombres.get(id) ?? "un empleado") : "un empleado");
}

// Un evento del historial (tipo "sistema") firmado por quien hace el cambio.
// `orden` desempata eventos de la misma escritura (mismo createdAt).
export function agregarEvento(
  w: Escritor,
  ticketId: string,
  evento: { mensaje: string; clave?: string; actorId: string; actorNombre: string; orden: number }
) {
  const ref = doc(collection(db, "tickets", ticketId, "eventos"));
  w.set(ref, {
    tipo: "sistema",
    mensaje: evento.mensaje,
    ...(evento.clave ? { clave: evento.clave } : {}),
    actorId: evento.actorId,
    actorNombre: evento.actorNombre,
    actorTipo: "usuario",
    orden: evento.orden,
    createdAt: serverTimestamp(),
  });
  return ref;
}

// Una notificación in-app por destinatario (sin duplicados ni a uno mismo).
// `eventoId`: el comentario que la origina, cuando no se escribe el ticket.
export function agregarNotificaciones(
  w: Escritor,
  destinatarios: Iterable<string>,
  remitenteId: string,
  datos: { ticketId: string; ticketCode: string; mensaje: string; eventoId?: string }
) {
  for (const userId of new Set(destinatarios)) {
    if (userId === remitenteId) continue;
    w.set(doc(collection(db, "notificaciones")), {
      userId,
      ticketId: datos.ticketId,
      ticketCode: datos.ticketCode,
      mensaje: datos.mensaje,
      ...(datos.eventoId ? { eventoId: datos.eventoId } : {}),
      leida: false,
      createdAt: serverTimestamp(),
    });
  }
}
