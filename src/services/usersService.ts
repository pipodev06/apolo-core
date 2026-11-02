import {
  collection,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  deleteField,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, functions, getAuthCuentas } from "../firebase";
import type { User } from "../types/user";
import type { Role } from "../lib/roles";
import { emailDeUsuario, mensajeErrorAuth, seccionesIniciales } from "../lib/cuentas";

export const usersService = {
  getAll: async () => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as User))
      .filter((u) => !u.deletedAt);
  },

  // Un solo usuario (null si no existe). Para mostrar un nombre no hace
  // falta descargar la colección entera.
  getById: async (id: string) => {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null;
  },

  // Crea la cuenta en Firebase Auth con la instancia secundaria (la sesión
  // del admin no cambia) y después users + access con la sesión del admin
  // (las reglas exigen admin). Si eso falla, se borra la cuenta de Auth.
  create: async (data: { username: string; password: string; email?: string; role: Role; personalId?: string }) => {
    const authCuentas = getAuthCuentas();
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(authCuentas, emailDeUsuario(data.username), data.password);
    } catch (error) {
      throw new Error(mensajeErrorAuth(error), { cause: error });
    }
    const uid = cred.user.uid;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        username: data.username.trim(),
        email: data.email ?? "",
        role: data.role,
        ...(data.personalId ? { personalId: data.personalId } : {}),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "access", uid), {
        userId: uid,
        sections: seccionesIniciales(data.role),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      await cred.user.delete().catch(() => {});
      throw error;
    } finally {
      await signOut(authCuentas).catch(() => {});
    }
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

  // El usuario es también el email de login en Firebase Auth: cambiarlo
  // necesita la Admin SDK (Cloud Function, solo super_admin).
  updateUsername: async (id: string, newUsername: string) => {
    const fn = httpsCallable(functions, "adminCuentas");
    await fn({ accion: "cambiarUsername", userId: id, username: newUsername });
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

  // Borra también su login de Firebase Auth: necesita la Admin SDK.
  eliminarDefinitivo: async (id: string) => {
    const fn = httpsCallable(functions, "adminCuentas");
    await fn({ accion: "eliminarCuenta", id });
  },
};
