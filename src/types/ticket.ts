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
  categoria?: string;      // nombre de la categoría (catálogo `categorias`, string suelto como `area`)
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
  solutionDescription?: string;
  problemImages?: string[];   // URLs de Storage — adjuntadas al crear/editar el ticket
  solutionImages?: string[];  // URLs de Storage — adjuntadas al cerrar el ticket
  // Quién hizo el último cambio (usuario o IA) — lo usa el historial de actividad.
  modificadoPor?: { tipo: "usuario" | "ia"; id?: string; nombre: string; en?: FirestoreTimestamp };
}
