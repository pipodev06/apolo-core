import { createHash } from "crypto";
import * as bcrypt from "bcryptjs";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Debe producir el mismo hash que src/lib/hash.ts (hashUsername), para
// poder buscar por usernameHash sin repetir un lookup por username en texto plano.
function hashUsername(username: string): string {
  return createHash("sha256").update(username.toLowerCase()).digest("hex");
}

interface LoginResult {
  customToken: string;
  userId: string;
  username: string;
  role: string;
}

// Verifica usuario/contraseña contra Firestore (server-side, el front nunca ve
// el passwordHash) y emite un Firebase Custom Token con el rol como claim.
// El cliente hace signInWithCustomToken con esto: a partir de ahí, request.auth
// en las Cloud Functions queda poblado de forma verificable (no falseable desde
// el cliente), a diferencia del rol que hoy vive solo en localStorage.
export const login = onCall(async (request) => {
  const username = request.data?.username;
  const password = request.data?.password;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    throw new HttpsError("invalid-argument", "Usuario y contraseña son requeridos.");
  }

  const db = getFirestore();
  const usernameHash = hashUsername(username);
  const usersSnap = await db.collection("users").where("usernameHash", "==", usernameHash).limit(1).get();

  const invalidCreds = () => new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");

  if (usersSnap.empty) {
    throw invalidCreds();
  }

  const userDoc = usersSnap.docs[0];
  const userData = userDoc.data();

  if (!userData.active) {
    throw invalidCreds();
  }

  const isMatch = await bcrypt.compare(password, userData.passwordHash as string);
  if (!isMatch) {
    throw invalidCreds();
  }

  const role = userData.role as string;
  const customToken = await getAuth().createCustomToken(userDoc.id, { role });

  const result: LoginResult = {
    customToken,
    userId: userDoc.id,
    username: userData.username as string,
    role,
  };
  return result;
});
