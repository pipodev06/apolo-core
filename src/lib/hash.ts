import bcrypt from "bcryptjs";
import { sha256 } from "js-sha256";

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// SHA-256 en JS puro (js-sha256): mismo resultado que crypto.subtle, pero funciona
// en cualquier origen (incluida la IP de red local / http no-seguro), no solo localhost/https.
export const hashUsername = async (username: string): Promise<string> => {
  return sha256(username.toLowerCase());
};
