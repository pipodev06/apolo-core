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

// Reset de la contraseña de OTRA cuenta por un admin (la propia se cambia
// desde el cliente, reautenticando). Cierra las sesiones abiertas de esa cuenta.
export const resetearPassword = onCall(async (request) => {
  const rol = await requireAdmin(request);
  const userId = request.data?.userId;
  const nueva = request.data?.passwordNueva;
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
});

// Cambiar el usuario de una cuenta (solo super_admin): actualiza el email de
// login en Auth y el username en users/{uid}. Auth rechaza un email ya
// usado, así que el usuario sigue siendo único.
export const cambiarUsername = onCall(async (request) => {
  if ((await rolDe(request)) !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede cambiar el usuario.");
  }
  const userId = request.data?.userId;
  const username = typeof request.data?.username === "string" ? request.data.username.trim() : "";
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
});
