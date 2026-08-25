import type { FirestoreTimestamp } from "./firestore";

export interface Empleado {
  id: string;
  nombre: string;
  cargo?: string;
  area?: string;
  email?: string;
  telefono?: string;
  activo: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  deletedAt?: FirestoreTimestamp | null; // soft-delete
}
