import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { User } from "../types/user";
import type { Role } from "../lib/roles";
import { esAdmin } from "../lib/roles";
import { hashPassword, hashUsername } from "../lib/hash";

export const usersService = {
  getAll: async () => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as User))
      .filter((u) => !u.deletedAt);
  },

  create: async (data: { username: string; password: string; email?: string; role: Role }) => {
    const usernameHash = await hashUsername(data.username);

    const usersRef = collection(db, "users");
    const existing = await getDocs(query(usersRef, where("usernameHash", "==", usernameHash), limit(1)));
    if (!existing.empty) throw new Error("El nombre de usuario ya existe");

    const passwordHash = await hashPassword(data.password);
    const allAccess = esAdmin(data.role);

    await runTransaction(db, async (transaction) => {
      const userRef = doc(collection(db, "users"));
      transaction.set(userRef, {
        username: data.username,
        usernameHash,
        passwordHash,
        email: data.email || "",
        role: data.role,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const accessRef = doc(db, "access", userRef.id);
      transaction.set(accessRef, {
        userId: userRef.id,
        sections: {
          dashboard: true,
          tickets: true,
          personal: allAccess,
          administracion: allAccess,
          notificaciones: true,
          papelera: true,
          historico: allAccess,
        },
        updatedAt: serverTimestamp(),
      });
    });
  },

  update: async (id: string, data: Partial<User>) => {
    const userRef = doc(db, "users", id);
    await updateDoc(userRef, {
      ...data,
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
