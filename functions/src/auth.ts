import { createHash } from "crypto";
import * as bcrypt from "bcryptjs";
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { sembrarCategoriasBase } from "./categorias";

// Debe producir el mismo hash que src/lib/hash.ts (hashUsername), para
// poder buscar por usernameHash sin repetir un lookup por username en texto plano.
function hashUsername(username: string): string {
  return createHash("sha256").update(username.toLowerCase()).digest("hex");
}

const ROLES = ["super_admin", "admin", "usuario"] as const;
const ROLES_ADMIN = ["admin", "super_admin"];
const BCRYPT_COST = 10;
const MIN_PASSWORD = 8;

// Rate limit del login: tras MAX_FALLOS intentos fallidos sobre el mismo
// usuario dentro de VENTANA_MS, se bloquea hasta que pase la ventana.
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

// Hash de relleno: si el usuario no existe igual se corre un bcrypt.compare,
// así el tiempo de respuesta no delata qué usernames existen.
const HASH_RELLENO = bcrypt.hashSync("relleno-no-es-una-clave", BCRYPT_COST);

// El passwordHash vive en `credenciales/{userId}` (reglas: sin acceso desde
// el cliente), NO en `users` — `users` lo lee cualquier sesión (nombres en
// el detalle de ticket, etc.) y antes eso exponía los hashes a todo el mundo.
const credencialRef = (userId: string) => getFirestore().collection("credenciales").doc(userId);

function rolDe(request: { auth?: { token?: Record<string, unknown> } }): string | undefined {
  const role = request.auth?.token?.role;
  return typeof role === "string" ? role : undefined;
}

export function requireAdmin(request: { auth?: { token?: Record<string, unknown> } }) {
  const role = rolDe(request);
  if (!role || !ROLES_ADMIN.includes(role)) {
    throw new HttpsError("permission-denied", "Requiere rol de administrador.");
  }
}

function validarPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new HttpsError("invalid-argument", `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  return password;
}

function validarUsername(username: unknown): string {
  if (typeof username !== "string" || username.trim().length < 3 || username.length > 60) {
    throw new HttpsError("invalid-argument", "El usuario debe tener entre 3 y 60 caracteres.");
  }
  return username.trim();
}

interface LoginResult {
  customToken: string;
  userId: string;
  username: string;
  role: string;
  personalId?: string;
}

// Verifica usuario/contraseña server-side y emite un Firebase Custom Token
// con el rol como claim. El cliente hace signInWithCustomToken con esto.
// minInstances: 1 deja una instancia siempre encendida, así el login no
// paga el "cold start" (2-6 s) tras un rato sin uso. Tiene un costo fijo
// pequeño al mes; para quitarlo, poner 0.
export const login = onCall({ minInstances: 1 }, async (request) => {
  const username = request.data?.username;
  const password = request.data?.password;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    throw new HttpsError("invalid-argument", "Usuario y contraseña son requeridos.");
  }

  const db = getFirestore();
  const usernameHash = hashUsername(username);
  const intentosRef = db.collection("loginIntentos").doc(usernameHash);
  const intentos = (await intentosRef.get()).data();
  const ahora = Date.now();
  const dentroDeVentana = intentos && ahora - (intentos.desde as Timestamp).toMillis() < VENTANA_MS;
  if (dentroDeVentana && (intentos.fallos as number) >= MAX_FALLOS) {
    const minutos = Math.ceil((VENTANA_MS - (ahora - (intentos.desde as Timestamp).toMillis())) / 60000);
    throw new HttpsError("resource-exhausted", `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.`);
  }

  const registrarFallo = async () => {
    await intentosRef.set(
      dentroDeVentana
        ? { fallos: FieldValue.increment(1) }
        : { fallos: 1, desde: Timestamp.fromMillis(ahora) },
      { merge: true }
    );
    return new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  };

  const usersSnap = await db.collection("users").where("usernameHash", "==", usernameHash).limit(1).get();
  const userDoc = usersSnap.docs[0];
  const userData = userDoc?.data();
  const hash = userDoc ? ((await credencialRef(userDoc.id).get()).data()?.passwordHash as string | undefined) : undefined;

  const isMatch = await bcrypt.compare(password, hash ?? HASH_RELLENO);
  if (!userDoc || !hash || !isMatch || !userData?.active || userData.deletedAt) {
    throw await registrarFallo();
  }

  await intentosRef.delete();

  const role = userData.role as string;
  // personalId vincula esta cuenta a un doc de personal/ (técnico) — permite que
  // firestore.rules acote cerrar un ticket / verlo a "solo el suyo".
  const personalId = userData.personalId as string | undefined;
  const customToken = await getAuth().createCustomToken(userDoc.id, personalId ? { role, personalId } : { role });

  const result: LoginResult = {
    customToken,
    userId: userDoc.id,
    username: userData.username as string,
    role,
    personalId,
  };
  return result;
});

// Crea users + credenciales + access en una transacción. Usado por el setup
// inicial y por crearUsuario.
async function crearCuenta(datos: {
  username: string;
  password: string;
  email?: string;
  role: (typeof ROLES)[number];
  personalId?: string;
}) {
  const db = getFirestore();
  const usernameHash = hashUsername(datos.username);
  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COST);
  const esAdmin = ROLES_ADMIN.includes(datos.role);
  const userRef = db.collection("users").doc();

  await db.runTransaction(async (tx) => {
    const existente = await tx.get(db.collection("users").where("usernameHash", "==", usernameHash).limit(1));
    if (!existente.empty) throw new HttpsError("already-exists", "El nombre de usuario ya existe.");

    tx.set(userRef, {
      username: datos.username,
      usernameHash,
      email: datos.email ?? "",
      role: datos.role,
      ...(datos.personalId ? { personalId: datos.personalId } : {}),
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(credencialRef(userRef.id), { passwordHash, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("access").doc(userRef.id), {
      userId: userRef.id,
      sections: {
        // Un "usuario" arranca solo con lo que puede usar: Tickets y
        // Notificaciones. Dashboard ("Mi resumen") y Papelera se pueden
        // habilitar después desde la Matriz de Accesos.
        dashboard: esAdmin,
        tickets: true,
        personal: esAdmin,
        administracion: esAdmin,
        notificaciones: true,
        papelera: esAdmin,
        historico: esAdmin,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return userRef.id;
}

// Setup inicial: crea el primer super_admin y config/app. Solo funciona si
// config/app todavía no existe — correr /setup apenas se despliega.
export const setupInicial = onCall(async (request) => {
  const username = validarUsername(request.data?.username);
  const password = validarPassword(request.data?.password);
  const email = typeof request.data?.email === "string" ? request.data.email : "";

  const db = getFirestore();
  const configRef = db.collection("config").doc("app");
  // create() falla si el doc ya existe: dos setups en paralelo no pueden pasar ambos.
  try {
    await configRef.create({
      ticketCounter: 0,
      series: "TK01",
      assignmentMode: "manual",
      maxTicketsAbiertos: 5,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    throw new HttpsError("failed-precondition", "El sistema ya fue inicializado.");
  }

  try {
    await crearCuenta({ username, password, email, role: "super_admin" });
    await db.collection("publico").doc("estado").set({ inicializado: true });
    await sembrarCategoriasBase();
  } catch (err) {
    // Sin el super_admin, config/app no debe quedar creado: dejaría la app
    // "inicializada" y sin nadie que pueda entrar.
    await configRef.delete();
    throw err;
  }
  return { ok: true };
});

// Fallback de `publico/estado` (la marca pública de "app inicializada" que
// leen Login y SetupGuard sin sesión): si falta — instalaciones previas a
// esta marca —, se deduce de config/app y se crea, así solo pasa una vez.
export const estadoSistema = onCall(async () => {
  const db = getFirestore();
  const inicializado = (await db.collection("config").doc("app").get()).exists;
  if (inicializado) await db.collection("publico").doc("estado").set({ inicializado: true });
  return { inicializado };
});

export const crearUsuario = onCall(async (request) => {
  requireAdmin(request);
  const username = validarUsername(request.data?.username);
  const password = validarPassword(request.data?.password);
  const role = request.data?.role;
  if (!ROLES.includes(role)) throw new HttpsError("invalid-argument", "Rol inválido.");
  if (role === "super_admin" && rolDe(request) !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede crear otro super admin.");
  }
  const email = typeof request.data?.email === "string" ? request.data.email : "";
  const personalId = typeof request.data?.personalId === "string" && request.data.personalId ? request.data.personalId : undefined;

  const id = await crearCuenta({ username, password, email, role, personalId });
  return { id };
});

// Cambio de contraseña. Sin userId (o el propio): exige la contraseña actual.
// Con userId ajeno: reset por admin (super_admin para tocar a otro super_admin),
// y se cierran las sesiones abiertas de esa cuenta.
export const cambiarPassword = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sesión requerida.");
  const nueva = validarPassword(request.data?.passwordNueva);
  const objetivo = typeof request.data?.userId === "string" && request.data.userId ? request.data.userId : uid;
  const propio = objetivo === uid;

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(objetivo).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
  if (userDoc.data()?.protegida === true && rolDe(request) !== "super_admin") {
    throw new HttpsError("permission-denied", "Esta cuenta está protegida: solo un super admin puede cambiar su contraseña.");
  }

  if (propio) {
    const actual = request.data?.passwordActual;
    const hash = (await credencialRef(uid).get()).data()?.passwordHash as string | undefined;
    if (typeof actual !== "string" || !hash || !(await bcrypt.compare(actual, hash))) {
      throw new HttpsError("permission-denied", "La contraseña actual no es correcta.");
    }
  } else {
    requireAdmin(request);
    if (userDoc.data()?.role === "super_admin" && rolDe(request) !== "super_admin") {
      throw new HttpsError("permission-denied", "Solo un super admin puede cambiar la contraseña de otro super admin.");
    }
  }

  await credencialRef(objetivo).set({
    passwordHash: await bcrypt.hash(nueva, BCRYPT_COST),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (!propio) await revocarSesiones(objetivo);
  return { ok: true };
});

export async function revocarSesiones(userId: string) {
  try {
    await getAuth().revokeRefreshTokens(userId);
  } catch (err) {
    // auth/user-not-found: la cuenta nunca inició sesión, no hay nada que revocar.
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
}

// Los claims (rol, personalId) quedan fijos en la sesión desde el login: si
// un admin desactiva, elimina o cambia el rol/vínculo de una cuenta, se
// revocan sus sesiones para que tenga que volver a entrar con datos frescos.
export const revocarSesionesUsuario = onDocumentUpdated("users/{userId}", async (event) => {
  const antes = event.data?.before.data();
  const despues = event.data?.after.data();
  if (!antes || !despues) return;

  const cambioSensible =
    (antes.active && !despues.active) ||
    (!antes.deletedAt && !!despues.deletedAt) ||
    antes.role !== despues.role ||
    (antes.personalId ?? null) !== (despues.personalId ?? null);
  if (!cambioSensible) return;

  await revocarSesiones(event.params.userId);
  logger.info(`Sesiones revocadas para usuario ${event.params.userId}`);
});
