import * as logger from "firebase-functions/logger";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// El login es nativo de Firebase Auth (desde el cliente). Acá quedan solo
// las operaciones de cuentas que necesitan la Admin SDK: resetear la
// contraseña de otro y cambiar el usuario (que también es el email de login).

// Mismo dominio y formato que src/lib/cuentas.ts.
const DOMINIO_CUENTAS = "apolo.local";
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,60}$/;
const MIN_PASSWORD = 8;
const ROLES_ADMIN = ["admin", "super_admin"];

const emailDeUsuario = (username: string) => `${username.trim().toLowerCase()}@${DOMINIO_CUENTAS}`;

// Rol de quien llama, leído de users/{uid} (no hay custom claims): mismo
// criterio que las reglas — solo cuenta si la cuenta está activa y fuera
// de la papelera.
async function rolDe(request: CallableRequest): Promise<string | undefined> {
  const uid = request.auth?.uid;
  if (!uid) return undefined;
  const data = (await getFirestore().collection("users").doc(uid).get()).data();
  if (!data || data.active !== true || data.deletedAt) return undefined;
  return typeof data.role === "string" ? data.role : undefined;
}

// Exige admin/super_admin y devuelve el rol de quien llama.
export async function requireAdmin(request: CallableRequest): Promise<string> {
  const role = await rolDe(request);
  if (!role || !ROLES_ADMIN.includes(role)) {
    throw new HttpsError("permission-denied", "Requiere rol de administrador.");
  }
  return role;
}

type Datos = Record<string, unknown> | undefined;

// Reset de la contraseña de OTRA cuenta por un admin (la propia se cambia
// desde el cliente, reautenticando). Cierra las sesiones abiertas de esa cuenta.
async function resetearPassword(request: CallableRequest, datos: Datos) {
  const rol = await requireAdmin(request);
  const userId = datos?.userId;
  const nueva = datos?.passwordNueva;
  if (typeof userId !== "string" || !userId) throw new HttpsError("invalid-argument", "Falta userId.");
  if (typeof nueva !== "string" || nueva.length < MIN_PASSWORD) {
    throw new HttpsError("invalid-argument", `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }

  const user = (await getFirestore().collection("users").doc(userId).get()).data();
  if (!user) throw new HttpsError("not-found", "Usuario no encontrado.");
  if ((user.role === "super_admin" || user.protegida === true) && rol !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede cambiar la contraseña de esta cuenta.");
  }

  await getAuth().updateUser(userId, { password: nueva });
  await getAuth().revokeRefreshTokens(userId);
  logger.info(`Contraseña de ${userId} reseteada por ${request.auth?.uid}`);
  return { ok: true };
}

// Cambiar el usuario de una cuenta (solo super_admin): actualiza el email de
// login en Auth y el username en users/{uid}. Auth rechaza un email ya
// usado, así que el usuario sigue siendo único.
async function cambiarUsername(request: CallableRequest, datos: Datos) {
  if ((await rolDe(request)) !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede cambiar el usuario.");
  }
  const userId = datos?.userId;
  const username = typeof datos?.username === "string" ? datos.username.trim() : "";
  if (typeof userId !== "string" || !userId) throw new HttpsError("invalid-argument", "Falta userId.");
  if (!USERNAME_REGEX.test(username)) {
    throw new HttpsError("invalid-argument", "Usuario inválido: 3 a 60 caracteres, letras, números, punto, guion o guion bajo.");
  }

  const ref = getFirestore().collection("users").doc(userId);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Usuario no encontrado.");

  try {
    await getAuth().updateUser(userId, { email: emailDeUsuario(username) });
  } catch (err) {
    if ((err as { code?: string }).code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "El nombre de usuario ya existe.");
    }
    throw err;
  }
  await ref.update({ username, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
}

// Borrado definitivo de una cuenta que ya está en la papelera: además del
// doc en users se lleva su matriz de accesos y su usuario de Firebase Auth
// (así no queda ninguna sesión viva y el nombre de usuario se libera). Lo
// demás de la papelera (tickets, personal, catálogos) se borra desde el
// cliente: las reglas lo permiten a un admin si el doc tiene deletedAt.
async function eliminarCuenta(request: CallableRequest, datos: Datos) {
  const rol = await requireAdmin(request);

  const id = datos?.id;
  if (typeof id !== "string" || !id) {
    throw new HttpsError("invalid-argument", "Falta el id de la cuenta.");
  }

  const db = getFirestore();
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "La cuenta no existe.");
  }
  const data = snap.data();
  if (!data?.deletedAt) {
    throw new HttpsError(
      "failed-precondition",
      "Solo se puede eliminar definitivamente una cuenta que ya está en la papelera."
    );
  }
  if ((data.role === "super_admin" || data.protegida === true) && rol !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede eliminar esta cuenta.");
  }

  await ref.delete();
  await Promise.all([
    db.collection("access").doc(id).delete(),
    getAuth().deleteUser(id).catch(() => {}),
  ]);
  return { ok: true };
}

const ACCIONES = { resetearPassword, cambiarUsername, eliminarCuenta } as const;

// Una sola función para las operaciones de cuentas que necesitan la Admin
// SDK: cada función desplegada es un servicio de Cloud Run que se cobra al
// arrancar (cada deploy lo arranca), así que juntarlas baja ese costo.
// Cada acción valida sus propios permisos. data = { accion, ...datos }.
export const adminCuentas = onCall(async (request) => {
  const accion = request.data?.accion;
  if (typeof accion !== "string" || !Object.hasOwn(ACCIONES, accion)) {
    throw new HttpsError("invalid-argument", "Acción de cuenta desconocida.");
  }
  return ACCIONES[accion as keyof typeof ACCIONES](request, request.data);
});
