import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TicketEvento } from "../types/evento";

export const eventosService = {
  watch: (ticketId: string, cb: (eventos: TicketEvento[]) => void) => {
    const ref = collection(db, "tickets", ticketId, "eventos");
    const q = query(ref, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketEvento)));
    });
  },

  agregarComentario: async (ticketId: string, texto: string, actorId: string, actorNombre: string) => {
    const ref = collection(db, "tickets", ticketId, "eventos");
    await addDoc(ref, {
      tipo: "comentario",
      texto,
      actorId,
      actorNombre,
      createdAt: serverTimestamp(),
    });
  },
};
