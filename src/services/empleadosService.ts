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
import type { Empleado } from "../types/empleado";

type EmpleadoInput = Pick<Empleado, "nombre" | "cargo" | "area" | "email" | "telefono" | "activo">;

export const empleadosService = {
  getAll: async () => {
    const ref = collection(db, "personal");
    const q = query(ref, orderBy("nombre", "asc"));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Empleado))
      .filter((e) => !e.deletedAt);
  },

  create: async (data: EmpleadoInput) => {
    const ref = collection(db, "personal");
    await addDoc(ref, {
      nombre: data.nombre,
      cargo: data.cargo || "",
      area: data.area || "",
      email: data.email || "",
      telefono: data.telefono || "",
      activo: data.activo ?? true,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  update: async (id: string, data: Partial<EmpleadoInput>) => {
    const ref = doc(db, "personal", id);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  toggleActivo: async (id: string, current: boolean) => {
    const ref = doc(db, "personal", id);
    await updateDoc(ref, { activo: !current, updatedAt: serverTimestamp() });
  },

  delete: async (id: string) => {
    const ref = doc(db, "personal", id);
    await updateDoc(ref, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },

  listarPapelera: async () => {
    const ref = collection(db, "personal");
    const q = query(ref, orderBy("nombre", "asc"));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Empleado))
      .filter((e) => !!e.deletedAt);
  },

  restaurar: async (id: string) => {
    await updateDoc(doc(db, "personal", id), { deletedAt: null, updatedAt: serverTimestamp() });
  },

  eliminarDefinitivo: async (id: string) => {
    const fn = httpsCallable(functions, "eliminarDefinitivo");
    await fn({ coleccion: "personal", id });
  },
};
