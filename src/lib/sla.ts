import { Timestamp } from "firebase/firestore";
import type { Ticket, Urgency } from "../types/ticket";
import type { FirestoreTimestamp } from "../types/firestore";

export type SlaHoras = Record<Urgency, number>;

// Horas máximas de resolución por urgencia, si config/app no define slaHoras.
export const SLA_DEFAULT: SlaHoras = { CRITICO: 4, ALTO: 8, MEDIO: 24, BAJO: 72 };

export const fechaMs = (t: FirestoreTimestamp | null | undefined): number => {
  if (!t) return 0;
  return t instanceof Timestamp ? t.toDate().getTime() : new Date(t).getTime();
};

// Vencimiento = registro del ticket + horas de SLA de su urgencia actual. Se
// calcula al vuelo (no se persiste), así cambiar la urgencia o el SLA en
// Administración se refleja al toque sin migrar datos.
export function venceEnMs(ticket: Ticket, sla: SlaHoras): number {
  return fechaMs(ticket.createdAt) + (sla[ticket.urgency] ?? SLA_DEFAULT[ticket.urgency]) * 3600_000;
}

// Abierto y pasado de su vencimiento, o terminado después de su vencimiento.
export function estaVencido(ticket: Ticket, sla: SlaHoras, ahora = Date.now()): boolean {
  if (!ticket.createdAt) return false;
  const fin = ticket.status === "terminado" ? fechaMs(ticket.finishedAt) || ahora : ahora;
  return fin > venceEnMs(ticket, sla);
}

// Tiempo de resolución (registro → terminado) en ms, o null si no aplica.
export function tiempoResolucionMs(ticket: Ticket): number | null {
  if (ticket.status !== "terminado" || !ticket.finishedAt || !ticket.createdAt) return null;
  return Math.max(0, fechaMs(ticket.finishedAt) - fechaMs(ticket.createdAt));
}

export function promedioResolucionMs(tickets: Ticket[]): number | null {
  const tiempos = tickets.map(tiempoResolucionMs).filter((t): t is number => t !== null);
  return tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
}

// "2 d 3 h", "5 h 20 min", "45 min".
export function fmtDuracion(ms: number | null): string {
  if (ms === null) return "-";
  const min = Math.round(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
