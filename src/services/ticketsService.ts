import {
  collection,
  getDoc,
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
import type { Ticket } from "../types/ticket";
import { generateTicketCode } from "../lib/ticketNumber";
import { esAdmin } from "../lib/roles";

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

  getById: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    const ticketDoc = await getDoc(ticketRef);
    if (!ticketDoc.exists()) throw new Error("Ticket no encontrado");
    return { id: ticketDoc.id, ...ticketDoc.data() } as Ticket;
  },

  // Tiempo real: la IA (u otro admin) puede modificar el ticket después de
  // creado (urgencia, asignación) — sin esto la UI se queda con los datos
  // viejos hasta que el usuario recarga la página a mano.
  //
  // Visibilidad (espejo de puedeVerTicket en firestore.rules): un admin ve
  // la colección entera; el resto, solo los que creó y los que tiene
  // asignados (2 listeners combinados). Firestore rechaza una query sin esos
  // filtros para un no-admin, aunque después se filtrara en el cliente.
  watch: (
    sesion: { userId: string; role: string; personalId?: string },
    cb: (tickets: Ticket[]) => void,
    soloPapelera = false,
    onError?: (error: Error) => void
  ) => {
    const ticketsRef = collection(db, "tickets");
    const queries = esAdmin(sesion.role)
      ? [query(ticketsRef, orderBy("order", "desc"))]
      : [
          query(ticketsRef, where("createdBy", "==", sesion.userId)),
          ...(sesion.personalId ? [query(ticketsRef, where("assignedTo", "==", sesion.personalId))] : []),
        ];

    const parciales: (Ticket[] | null)[] = queries.map(() => null);
    const emitir = () => {
      if (parciales.some((p) => p === null)) return; // esperar a que respondan todas
      const porId = new Map<string, Ticket>();
      for (const lista of parciales) for (const t of lista!) porId.set(t.id, t);
      cb(
        [...porId.values()]
          .filter((t) => (soloPapelera ? !!t.deletedAt : !t.deletedAt))
          .sort((a, b) => b.order - a.order)
      );
    };

    const unsubs = queries.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          parciales[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
          emitir();
        },
        (error) => onError?.(error)
      )
    );
    return () => unsubs.forEach((u) => u());
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
