import type { FirestoreTimestamp } from "./firestore";

export type TicketEventoTipo = "sistema" | "comentario";

export interface TicketEvento {
  id: string;
  tipo: TicketEventoTipo;
  mensaje?: string;       // tipo=sistema
  texto?: string;         // tipo=comentario
  imagenes?: string[];    // tipo=comentario, URLs de Storage
  actorId?: string;
  actorNombre?: string;
  actorTipo?: "usuario" | "ia"; // solo tipo=sistema   // comentario: autor; sistema: quién hizo el cambio (usuario o "Asistente IA")
  createdAt: FirestoreTimestamp;
}
