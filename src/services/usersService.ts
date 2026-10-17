import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { User } from "../types/user";
import type { Role } from "../lib/roles";
import { hashUsername } from "../lib/hash";

export const usersService = {
  getAll: async () => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as User))
      .filter((u) => !u.deletedAt);
  },

  // Vía Cloud Function: hashea la contraseña server-side y crea users +
  // credenciales + access en una transacción.
  create: async (data: { username: string; password: string; email?: string; role: Role; personalId?: string }) => {
    const fn = httpsCallable(functions, "crearUsuario");
    await fn(data);
  },

  update: async (id: string, data: Partial<User>) => {
    const userRef = doc(db, "users", id);
    // Firestore rechaza `undefined` como valor de campo en updateDoc — un caller
    // que pase p. ej. personalId: undefined quiere decir "limpiar ese campo",
    // no "no tocarlo" (para eso simplemente no incluye la key).
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v])
    );
    await updateDoc(userRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  },

  // Solo super_admin puede llegar hasta aquí (ver UsuariosTab); las reglas de
  // Firestore además exigen el custom claim role == 'super_admin' para que
  // el cambio de username pase, sea cual sea quien llame a este método.
  updateUsername: async (id: string, newUsername: string) => {
    const usernameHash = await hashUsername(newUsername);

    const usersRef = collection(db, "users");
    const existing = await getDocs(query(usersRef, where("usernameHash", "==", usernameHash), limit(1)));
    if (!existing.empty && existing.docs[0].id !== id) {
      throw new Error("El nombre de usuario ya existe");
    }

    const userRef = doc(db, "users", id);
    await updateDoc(userRef, { username: newUsername, usernameHash, updatedAt: serverTimestamp() });
  },

  toggleActive: async (id: string, currentStatus: boolean) => {
    const userRef = doc(db, "users", id);
    await updateDoc(userRef, {
      active: !currentStatus,
      updatedAt: serverTimestamp(),
    });
  },

  delete: async (id: string) => {
    const userRef = doc(db, "users", id);
    await updateDoc(userRef, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },

  listarPapelera: async () => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as User))
      .filter((u) => !!u.deletedAt);
  },

  restaurar: async (id: string) => {
    await updateDoc(doc(db, "users", id), { deletedAt: null, updatedAt: serverTimestamp() });
  },

  eliminarDefinitivo: async (id: string) => {
    const fn = httpsCallable(functions, "eliminarDefinitivo");
    await fn({ coleccion: "users", id });
  },
};
