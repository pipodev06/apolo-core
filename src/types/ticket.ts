import type { FirestoreTimestamp } from "./firestore";

export type Urgency = "CRITICO" | "ALTO" | "MEDIO" | "BAJO";
export type TicketStatus = "pendiente" | "asignado" | "en_proceso" | "terminado";

export interface Ticket {
  id: string;
  order: number;
  code: string;            // "TK01-0001"
  title: string;
  description: string;
  incidentTime: FirestoreTimestamp;
  urgency: Urgency;
  status: TicketStatus;
  area?: string;           // área asignada (manual o inferida por IA)
  assignedTo?: string;     // id de empleado
  assignedAt?: FirestoreTimestamp | null; // hora de asignación
  createdBy: string;
  // Snapshot del username al momento de crear el ticket — sobrevive aunque el
  // usuario se elimine (soft o definitivo) más adelante, para no perder el
  // dato en el historial. Tickets creados antes de este campo no lo tienen.
  createdByUsername?: string;
  createdAt: FirestoreTimestamp;
  finishedAt?: FirestoreTimestamp | null;
  updatedAt: FirestoreTimestamp;
  deletedAt?: FirestoreTimestamp | null; // soft-delete
}
