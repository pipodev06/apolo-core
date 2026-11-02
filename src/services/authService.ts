import { getDoc, doc, runTransaction, serverTimestamp, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { auth, db, functions } from "../firebase";
import { emailDeUsuario, mensajeErrorAuth, seccionesIniciales } from "../lib/cuentas";
import { cargarCategoriasBase } from "./catalogosService";

export const authService = {
  // Login nativo de Firebase Auth (email interno derivado del usuario). El
  // rol y el vínculo a personal/ salen del doc users/{uid}, que también es
  // lo que leen las reglas: una cuenta desactivada o en papelera no entra.
  login: async (username: string, password: string) => {
    let uid: string;
    try {
      ({ user: { uid } } = await signInWithEmailAndPassword(auth, emailDeUsuario(username), password));
    } catch (error) {
      throw new Error(mensajeErrorAuth(error), { cause: error });
    }

    // Una cuenta inactiva no puede leer ni su propio doc (reglas): cae al catch.
    const data = await getDoc(doc(db, "users", uid))
      .then((snap) => snap.data())
      .catch(() => undefined);
    if (!data || data.active !== true || data.deletedAt) {
      await signOut(auth);
      throw new Error("Tu cuenta está desactivada. Habla con un administrador.");
    }

    const session = {
      userId: uid,
      username: data.username as string,
      role: data.role as string,
      personalId: data.personalId as string | undefined,
      expiresAt: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
    };

    localStorage.setItem("session", JSON.stringify(session));
    return session;
  },

  // Además de cerrar la sesión, borra la caché local de Firestore (en una PC
  // compartida no deben quedar datos del usuario anterior) y recarga en
  // /login: tras terminate() la instancia de Firestore ya no se puede usar.
  logout: async () => {
    localStorage.removeItem("session");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("access:")) localStorage.removeItem(key);
    }
    await signOut(auth).catch(() => {});
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch {
      // Si otra pestaña sigue usando la caché no se puede borrar; no es
      // motivo para dejar al usuario sin poder salir.
    }
    window.location.assign("/login");
  },

  getSession: () => {
    const sessionStr = localStorage.getItem("session");
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem("session");
      return null;
    }

    return session;
  },

  // Crea el primer super_admin: la cuenta en Auth y, en una transacción,
  // config/app + users + access + publico/estado. Las reglas solo lo
  // permiten mientras config/app no exista; si otro setup ganó la carrera,
  // se borra la cuenta recién creada.
  setupInitialAdmin: async (data: { username: string; password: string; email?: string }) => {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, emailDeUsuario(data.username), data.password);
    } catch (error) {
      throw new Error(mensajeErrorAuth(error), { cause: error });
    }
    const uid = cred.user.uid;

    try {
      await runTransaction(db, async (tx) => {
        const estadoRef = doc(db, "publico", "estado");
        if ((await tx.get(estadoRef)).exists()) throw new Error("El sistema ya fue inicializado.");
        tx.set(doc(db, "config", "app"), {
          ticketCounter: 0,
          series: "TK01",
          assignmentMode: "manual",
          maxTicketsAbiertos: 5,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, "users", uid), {
          username: data.username.trim(),
          email: data.email ?? "",
          role: "super_admin",
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, "access", uid), {
          userId: uid,
          sections: seccionesIniciales("super_admin"),
          updatedAt: serverTimestamp(),
        });
        tx.set(estadoRef, { inicializado: true });
      });
    } catch (error) {
      await cred.user.delete().catch(() => {});
      throw error;
    }

    // Ya es super_admin: siembra las categorías base. Si falla, quedan
    // disponibles con el botón de Administración → Categorías.
    await cargarCategoriasBase().catch(() => {});
    await signOut(auth);
  },

  // Sin userId: cambia la contraseña propia (exige la actual). Con userId:
  // reset por admin, que necesita la Admin SDK (Cloud Function).
  cambiarPassword: async (data: { passwordNueva: string; passwordActual?: string; userId?: string }) => {
    if (data.userId) {
      const fn = httpsCallable(functions, "adminCuentas");
      await fn({ accion: "resetearPassword", userId: data.userId, passwordNueva: data.passwordNueva });
      return;
    }
    const user = auth.currentUser;
    if (!user?.email) throw new Error("Sesión requerida.");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, data.passwordActual ?? ""));
    } catch {
      throw new Error("La contraseña actual no es correcta.");
    }
    try {
      await updatePassword(user, data.passwordNueva);
    } catch (error) {
      throw new Error(mensajeErrorAuth(error), { cause: error });
    }
  },

  // ¿Ya se corrió el setup? Se lee `publico/estado`, la única lectura sin
  // sesión que permiten las reglas.
  appEstaInicializada: async () => {
    const snap = await getDoc(doc(db, "publico", "estado"));
    return snap.exists() && snap.data().inicializado === true;
  },
};
