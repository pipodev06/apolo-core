import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { Catalogo } from "../types/catalogo";

// Factory de servicio CRUD para catálogos simples (soft-delete + activo).
export function crearCatalogoService(coleccion: string) {
  return {
    getAll: async (): Promise<Catalogo[]> => {
      const ref = collection(db, coleccion);
      const q = query(ref, orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Catalogo))
        .filter((c) => !c.deletedAt);
    },

    create: async (nombre: string) => {
      await addDoc(collection(db, coleccion), {
        nombre,
        activo: true,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    update: async (id: string, nombre: string) => {
      await updateDoc(doc(db, coleccion, id), { nombre, updatedAt: serverTimestamp() });
    },

    toggleActivo: async (id: string, current: boolean) => {
      await updateDoc(doc(db, coleccion, id), { activo: !current, updatedAt: serverTimestamp() });
    },

    delete: async (id: string) => {
      await updateDoc(doc(db, coleccion, id), {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    listarPapelera: async (): Promise<Catalogo[]> => {
      const ref = collection(db, coleccion);
      const q = query(ref, orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Catalogo))
        .filter((c) => !!c.deletedAt);
    },

    restaurar: async (id: string) => {
      await updateDoc(doc(db, coleccion, id), { deletedAt: null, updatedAt: serverTimestamp() });
    },

    eliminarDefinitivo: async (id: string) => {
      const fn = httpsCallable(functions, "eliminarDefinitivo");
      await fn({ coleccion, id });
    },
  };
}

export type CatalogoService = ReturnType<typeof crearCatalogoService>;

export const cargosService = crearCatalogoService("cargos");
export const areasService = crearCatalogoService("areas");
