import type { FirestoreTimestamp } from "./firestore";

export interface Notificacion {
  id: string;
  userId: string;
  ticketId: string;
  ticketCode: string;
  mensaje: string;
  leida: boolean;
  createdAt: FirestoreTimestamp;
}
