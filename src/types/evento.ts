import type { FirestoreTimestamp } from "./firestore";

export type TicketEventoTipo = "sistema" | "comentario";

export interface TicketEvento {
  id: string;
  tipo: TicketEventoTipo;
  mensaje?: string;       // tipo=sistema
  texto?: string;         // tipo=comentario
  actorId?: string;
  actorNombre?: string;
  createdAt: FirestoreTimestamp;
}
