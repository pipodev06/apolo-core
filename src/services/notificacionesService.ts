import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Notificacion } from "../types/notificacion";

export const notificacionesService = {
  watch: (userId: string, cb: (notificaciones: Notificacion[]) => void) => {
    const ref = collection(db, "notificaciones");
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion)));
    });
  },

  // Sin límite de 20 — para la vista /notificaciones donde se listan todas.
  watchAll: (userId: string, cb: (notificaciones: Notificacion[]) => void) => {
    const ref = collection(db, "notificaciones");
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacion)));
    });
  },

  marcarLeida: async (id: string) => {
    await updateDoc(doc(db, "notificaciones", id), { leida: true });
  },

  marcarTodasLeidas: async (ids: string[]) => {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(doc(db, "notificaciones", id), { leida: true }));
    await batch.commit();
  },
};
