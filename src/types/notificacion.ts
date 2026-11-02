import type { FirestoreTimestamp } from "./firestore";

export interface Notificacion {
  id: string;
  userId: string;
  ticketId: string;
  ticketCode: string;
  mensaje: string;
  eventoId?: string;      // comentario que la originó
  leida: boolean;
  expiraEn?: FirestoreTimestamp; // al marcarse leída: la borra la TTL policy de Firestore
  createdAt: FirestoreTimestamp;
}
