import { sha256 } from "js-sha256";

// SHA-256 en JS puro (js-sha256): mismo resultado que crypto.subtle, pero funciona
// en cualquier origen (incluida la IP de red local / http no-seguro), no solo localhost/https.
// Las contraseñas ya no se hashean en el cliente: eso lo hacen las Cloud
// Functions (setupInicial, crearUsuario, cambiarPassword).
export const hashUsername = async (username: string): Promise<string> => {
  return sha256(username.toLowerCase());
};
