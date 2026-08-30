import {
  collection,
  getDoc,
  serverTimestamp,
  runTransaction,
  doc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth, db, functions } from "../firebase";
import { hashPassword, hashUsername } from "../lib/hash";

interface LoginResult {
  customToken: string;
  userId: string;
  username: string;
  role: string;
  personalId?: string;
}

export const authService = {
  // La verificación de usuario/contraseña ocurre en la Cloud Function "login"
  // (server-side, contra el passwordHash en Firestore). signInWithCustomToken
  // deja a Firebase Auth con un rol verificable en request.auth.token.role,
  // que las Cloud Functions sensibles (p. ej. reanalizarTicketIA) usan para
  // autorizar — a diferencia del "role" cacheado abajo en localStorage, que
  // solo sirve para pintar la UI y no es una fuente de autorización confiable.
  login: async (username: string, password: string) => {
    const fn = httpsCallable<{ username: string; password: string }, LoginResult>(functions, "login");
    let data: LoginResult;
    try {
      ({ data } = await fn({ username, password }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Error al iniciar sesión", { cause: error });
    }

    await signInWithCustomToken(auth, data.customToken);

    const session = {
      userId: data.userId,
      username: data.username,
      role: data.role,
      personalId: data.personalId,
      expiresAt: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
    };

    localStorage.setItem("session", JSON.stringify(session));
    return session;
  },

  logout: () => {
    localStorage.removeItem("session");
    signOut(auth).catch(() => {});
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

  setupInitialAdmin: async (data: { username: string; password: string; email?: string }) => {
    const { username, password, email } = data;
    const usernameHash = await hashUsername(username);
    const passwordHash = await hashPassword(password);

    await runTransaction(db, async (transaction) => {
      // 1. Create User
      const userRef = doc(collection(db, "users"));
      transaction.set(userRef, {
        username,
        usernameHash,
        passwordHash,
        email: email || "",
        role: "super_admin",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Create Access
      const accessRef = doc(db, "access", userRef.id);
      transaction.set(accessRef, {
        userId: userRef.id,
        sections: {
          dashboard: true,
          tickets: true,
          personal: true,
          administracion: true,
          notificaciones: true,
          papelera: true,
          historico: true,
        },
        updatedAt: serverTimestamp(),
      });

      // 3. Initialize Config
      const configRef = doc(db, "config", "app");
      transaction.set(configRef, {
        ticketCounter: 0,
        series: "TK01",
        assignmentMode: "manual",
        maxTicketsAbiertos: 5,
        updatedAt: serverTimestamp(),
      });
    });
  },

  // Mismo criterio que appYaInicializada() en firestore.rules: existencia de
  // config/app (lectura abierta siempre, a diferencia de `users`, que exige
  // sesión real una vez pasado el bootstrap) — no usar hasUsers()/leer
  // `users` acá, un cliente sin loguear no tiene permiso para eso después
  // del setup y la lectura falla con PERMISSION_DENIED.
  appEstaInicializada: async () => {
    const configRef = doc(db, "config", "app");
    const snap = await getDoc(configRef);
    return snap.exists();
  }
};
