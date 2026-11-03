import type { FirestoreTimestamp } from "./firestore";

export interface Empleado {
  id: string;
  nombre: string;
  cargo?: string;
  area?: string;
  email?: string;
  telefono?: string;
  activo: boolean;
  // Recibe tickets (IA y "Asignar a"). Sin el campo (fichas anteriores a la
  // casilla) cuenta como técnico: usar esTecnico(), no leerlo directo.
  tecnico?: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  deletedAt?: FirestoreTimestamp | null; // soft-delete
}

export const esTecnico = (e: Pick<Empleado, "tecnico">) => e.tecnico !== false;
