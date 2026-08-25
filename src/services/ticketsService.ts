import {
  collection,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  type UpdateData
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { Ticket, Urgency, TicketStatus } from "../types/ticket";
import { generateTicketCode } from "../lib/ticketNumber";

export const ticketsService = {
  create: async (data: Omit<Ticket, "id" | "order" | "code" | "createdAt" | "updatedAt">) => {
    return await runTransaction(db, async (transaction) => {
      const configRef = doc(db, "config", "app");
      const configDoc = await transaction.get(configRef);
      
      if (!configDoc.exists()) {
        throw new Error("Configuración de la aplicación no encontrada");
      }

      const configData = configDoc.data();
      const nextOrder = (configData.ticketCounter || 0) + 1;
      const series = configData.series || "TK01";
      const code = generateTicketCode(series, nextOrder);

      const ticketRef = doc(collection(db, "tickets"));
      const newTicket = {
        ...data,
        order: nextOrder,
        code,
        assignedAt: data.assignedTo ? serverTimestamp() : null,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      transaction.set(ticketRef, newTicket);
      transaction.update(configRef, { ticketCounter: nextOrder });

      return { id: ticketRef.id, ...newTicket };
    });
  },

  getAll: async (filters?: { status?: TicketStatus; urgency?: Urgency }) => {
    const ticketsRef = collection(db, "tickets");
    let q = query(ticketsRef, orderBy("order", "desc"));

    if (filters?.status) {
      q = query(q, where("status", "==", filters.status));
    }
    if (filters?.urgency) {
      q = query(q, where("urgency", "==", filters.urgency));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Ticket))
      .filter(ticket => !ticket.deletedAt);
  },

  getById: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    const ticketDoc = await getDoc(ticketRef);
    if (!ticketDoc.exists()) throw new Error("Ticket no encontrado");
    return { id: ticketDoc.id, ...ticketDoc.data() } as Ticket;
  },

  // Tiempo real: la IA (u otro admin) puede modificar el ticket después de
  // creado (urgencia, asignación) — sin esto la UI se queda con los datos
  // viejos hasta que el usuario recarga la página a mano.
  watch: (cb: (tickets: Ticket[]) => void, soloPapelera = false) => {
    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, orderBy("order", "desc"));
    return onSnapshot(q, (snap) => {
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
      cb(todos.filter((t) => (soloPapelera ? !!t.deletedAt : !t.deletedAt)));
    });
  },

  watchById: (id: string, cb: (ticket: Ticket | null) => void) => {
    const ticketRef = doc(db, "tickets", id);
    return onSnapshot(ticketRef, (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ticket) : null);
    });
  },

  update: async (id: string, data: Partial<Ticket>) => {
    const ticketRef = doc(db, "tickets", id);
    const updateData: UpdateData<Ticket> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    if (data.status === "terminado") {
      updateData.finishedAt = serverTimestamp();
    } else if (data.status) {
      // Reabrir un ticket que ya había sido terminado: limpiar finishedAt,
      // si no queda con una fecha de "finalizado" vieja y falsa (rompe
      // cualquier métrica de tiempo de resolución que se calcule a futuro).
      updateData.finishedAt = null;
    }

    await updateDoc(ticketRef, updateData);
  },

  delete: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    await updateDoc(ticketRef, {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  listarPapelera: async () => {
    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, orderBy("order", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Ticket))
      .filter((ticket) => !!ticket.deletedAt);
  },

  restaurar: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    await updateDoc(ticketRef, { deletedAt: null, updatedAt: serverTimestamp() });
  },

  eliminarDefinitivo: async (id: string) => {
    const fn = httpsCallable(functions, "eliminarDefinitivo");
    await fn({ coleccion: "tickets", id });
  },

  reanalizarIA: async (id: string) => {
    const fn = httpsCallable<{ ticketId: string }, { ok: boolean; motivo?: string }>(
      functions,
      "reanalizarTicketIA"
    );
    const { data } = await fn({ ticketId: id });
    return data;
  }
};
