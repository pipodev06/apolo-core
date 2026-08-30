export type { Role } from "../lib/roles";
import type { Role } from "../lib/roles";
import type { FirestoreTimestamp } from "./firestore";

export interface User {
  id: string;
  username: string;
  usernameHash: string;
  passwordHash: string;
  email?: string;
  role: Role;
  // id del doc en personal/ vinculado a esta cuenta — solo aplica a técnicos
  // (role "usuario"), habilita cerrar/editar sus propios tickets asignados.
  personalId?: string;
  active: boolean;
  deletedAt?: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
