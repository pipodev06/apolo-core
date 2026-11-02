import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TicketEvento } from "../types/evento";
import type { Ticket } from "../types/ticket";
import { IA_CREATED_BY, mensajeComentario } from "../lib/historial";
import { toDate } from "../lib/fecha";
import { agregarNotificaciones, usuariosDeEmpleado } from "./historialService";

// Mismo createdAt (escritos en un mismo batch): desempata por `orden`. Un
// evento recién escrito todavía sin fecha del servidor va al final.
const ms = (e: TicketEvento) => toDate(e.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
const porFechaYOrden = (a: TicketEvento, b: TicketEvento) => ms(a) - ms(b) || (a.orden ?? 0) - (b.orden ?? 0);

export const eventosService = {
  watch: (ticketId: string, cb: (eventos: TicketEvento[]) => void) => {
    const ref = collection(db, "tickets", ticketId, "eventos");
    const q = query(ref, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketEvento)).sort(porFechaYOrden));
    });
  },

  // Comentario + notificación al creador y al técnico asignado, en un batch.
  agregarComentario: async (
    ticketId: string,
    texto: string,
    actorId: string,
    actorNombre: string,
    imagenes?: string[]
  ) => {
    const ticket = (await getDoc(doc(db, "tickets", ticketId))).data() as Ticket | undefined;
    if (!ticket) throw new Error("Ticket no encontrado");
    const tecnicos = await usuariosDeEmpleado(ticket.assignedTo);

    const batch = writeBatch(db);
    const ref = doc(collection(db, "tickets", ticketId, "eventos"));
    batch.set(ref, {
      tipo: "comentario",
      texto,
      actorId,
      actorNombre,
      ...(imagenes?.length ? { imagenes } : {}),
      createdAt: serverTimestamp(),
    });
    const creador = ticket.createdBy !== IA_CREATED_BY ? [ticket.createdBy] : [];
    agregarNotificaciones(batch, [...creador, ...tecnicos], actorId, {
      ticketId,
      ticketCode: ticket.code,
      mensaje: mensajeComentario(actorNombre, texto),
      eventoId: ref.id,
    });
    await batch.commit();
  },
};
