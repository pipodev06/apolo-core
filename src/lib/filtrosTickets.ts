import type { Ticket, TicketStatus, Urgency } from "../types/ticket";
import { descargarCsv } from "./csv";
import { fmtFechaHora } from "./fecha";
import { estaVencido, fechaMs, fmtDuracion, tiempoResolucionMs, type SlaHoras } from "./sla";
import { STATUS_LABELS, URGENCY_LABELS } from "./ticketStatus";

// Valor del filtro de categoría para "tickets sin categoría".
export const SIN_CATEGORIA = "__sin_categoria__";

// Filtros de la lista de tickets. "" = sin filtrar por ese campo.
export interface FiltrosTicket {
  query: string;
  estado: TicketStatus | "";
  urgencia: Urgency | "";
  categoria: string; // SIN_CATEGORIA = tickets sin categoría
  desde: string; // yyyy-mm-dd
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosTicket = { query: "", estado: "", urgencia: "", categoria: "", desde: "", hasta: "" };

export const hayFiltrosActivos = (f: FiltrosTicket) => Object.values(f).some(Boolean);

// Filtra por estado, urgencia, categoría, rango de fecha de registro y texto
// libre (código, título, técnico asignado o categoría). Mantiene el orden.
export function filtrarTickets(
  tickets: Ticket[],
  f: FiltrosTicket,
  nombreEmpleado: (id: string) => string | undefined
): Ticket[] {
  const q = f.query.trim().toLowerCase();
  const desde = f.desde ? new Date(f.desde + "T00:00:00").getTime() : -Infinity;
  const hasta = f.hasta ? new Date(f.hasta + "T23:59:59").getTime() : Infinity;
  return tickets.filter((t) => {
    if (f.estado && t.status !== f.estado) return false;
    if (f.urgencia && t.urgency !== f.urgencia) return false;
    if (f.categoria === SIN_CATEGORIA ? !!t.categoria : f.categoria && t.categoria !== f.categoria) return false;
    if (q) {
      const nombre = t.assignedTo ? nombreEmpleado(t.assignedTo) || "" : "";
      const coincide =
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        nombre.toLowerCase().includes(q) ||
        (t.categoria ?? "").toLowerCase().includes(q);
      if (!coincide) return false;
    }
    const ms = fechaMs(t.createdAt);
    return ms >= desde && ms <= hasta;
  });
}

// Descarga como CSV los tickets que se le pasan (lo filtrado en pantalla).
export function exportarTicketsCsv(tickets: Ticket[], asignado: (t: Ticket) => string, sla: SlaHoras) {
  descargarCsv(
    `tickets-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Código", "Título", "Estado", "Urgencia", "Categoría", "Área", "Asignado a", "Registrado", "Terminado", "Tiempo de resolución", "SLA"],
    tickets.map((t) => [
      t.code,
      t.title,
      STATUS_LABELS[t.status],
      URGENCY_LABELS[t.urgency],
      t.categoria ?? "",
      t.area ?? "",
      asignado(t),
      fmtFechaHora(t.createdAt),
      fmtFechaHora(t.finishedAt),
      fmtDuracion(tiempoResolucionMs(t)),
      estaVencido(t, sla) ? "Vencido" : "En plazo",
    ])
  );
}
