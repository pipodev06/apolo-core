import type { Ticket } from "../types/ticket";

// Mismo criterio que analizarYAsignar en functions/src/analizar.ts: un
// ticket cuenta como "carga" de un empleado si está asignado a él y sigue
// abierto (no terminado, no en la papelera).
const ESTADOS_ABIERTOS: Ticket["status"][] = ["asignado", "en_proceso"];

export function calcularCarga(tickets: Ticket[], empleadoId: string): number {
  return tickets.filter(
    (t) => t.assignedTo === empleadoId && ESTADOS_ABIERTOS.includes(t.status) && !t.deletedAt
  ).length;
}

export function estaOcupado(carga: number, maxTicketsAbiertos: number | null | undefined): boolean {
  if (maxTicketsAbiertos == null) return false;
  return carga >= maxTicketsAbiertos;
}
