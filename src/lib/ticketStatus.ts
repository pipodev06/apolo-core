import type { TicketStatus } from "../types/ticket";

// Mismas transiciones prohibidas que transicionDeEstadoValida en
// firestore.rules — no saltar pasos hacia adelante (pendiente→en_proceso/
// terminado directo, asignado→terminado directo). Hacia atrás (incluido
// reabrir un terminado) no hay restricción.
const SALTOS_PROHIBIDOS: [TicketStatus, TicketStatus][] = [
  ["pendiente", "en_proceso"],
  ["pendiente", "terminado"],
  ["asignado", "terminado"],
];

export function transicionEstadoValida(actual: TicketStatus, nuevo: TicketStatus): boolean {
  if (actual === nuevo) return true;
  return !SALTOS_PROHIBIDOS.some(([desde, hasta]) => desde === actual && hasta === nuevo);
}
