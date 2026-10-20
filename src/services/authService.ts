import { getDoc, doc, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth, db, functions } from "../firebase";

interface LoginResult {
  customToken: string;
  userId: string;
  username: string;
  role: string;
  personalId?: string;
}

export const authService = {
  // La verificación de usuario/contraseña ocurre en la Cloud Function "login"
  // (server-side, contra `credenciales/{userId}`). signInWithCustomToken
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

  // El primer super_admin + config/app los crea la Cloud Function
  // setupInicial (hashea la contraseña server-side; falla si ya hay setup).
  setupInitialAdmin: async (data: { username: string; password: string; email?: string }) => {
    const fn = httpsCallable(functions, "setupInicial");
    await fn(data);
  },

  // Sin userId: cambia la contraseña propia (exige la actual). Con userId:
  // reset por admin.
  cambiarPassword: async (data: { passwordNueva: string; passwordActual?: string; userId?: string }) => {
    const fn = httpsCallable(functions, "cambiarPassword");
    await fn(data);
  },

  // ¿Ya se corrió el setup? Se lee `publico/estado`, la única lectura sin
  // sesión que permiten las reglas (config/app y users exigen sesión).
  appEstaInicializada: async () => {
    const snap = await getDoc(doc(db, "publico", "estado"));
    if (snap.exists()) return snap.data().inicializado === true;
    // Sin la marca (instalación nueva, o previa a esta marca): la Function
    // lo deduce de config/app y crea la marca si corresponde.
    const fn = httpsCallable<void, { inicializado: boolean }>(functions, "estadoSistema");
    const { data } = await fn();
    return data.inicializado;
  }
};
