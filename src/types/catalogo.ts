import type { FirestoreTimestamp } from "./firestore";

// Entidad genérica de catálogo (cargos, áreas).
export interface Catalogo {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  deletedAt?: FirestoreTimestamp | null; // soft-delete
}
