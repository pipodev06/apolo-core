export type { Role } from "../lib/roles";
import type { Role } from "../lib/roles";
import type { FirestoreTimestamp } from "./firestore";

export interface User {
  id: string;
  username: string;
  usernameHash: string;
  email?: string;
  role: Role;
  // id del doc en personal/ vinculado a esta cuenta — solo aplica a técnicos
  // (role "usuario"), habilita cerrar/editar sus propios tickets asignados.
  personalId?: string;
  active: boolean;
  // Cuenta protegida (ej. las de la demo pública): solo un super_admin puede
  // editarla, cambiarle la contraseña, desactivarla o eliminarla.
  protegida?: boolean;
  deletedAt?: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
