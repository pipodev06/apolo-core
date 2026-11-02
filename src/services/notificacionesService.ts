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
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Notificacion } from "../types/notificacion";

// Días que se conserva una notificación leída antes de que la borre la TTL
// policy de Firestore (campo "expiraEn", se configura en la consola).
const DIAS_RETENCION_LEIDAS = 7;
const leida = () => ({
  leida: true,
  expiraEn: Timestamp.fromMillis(Date.now() + DIAS_RETENCION_LEIDAS * 24 * 60 * 60 * 1000),
});

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
    await updateDoc(doc(db, "notificaciones", id), leida());
  },

  marcarTodasLeidas: async (ids: string[]) => {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    const datos = leida();
    ids.forEach((id) => batch.update(doc(db, "notificaciones", id), datos));
    await batch.commit();
  },
};
