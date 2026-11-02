import { Timestamp } from "firebase/firestore";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { Ticket } from "../types/ticket";
import type { Empleado } from "../types/empleado";
import { estaVencido, promedioResolucionMs, type SlaHoras } from "./sla";

export interface Dato {
  name: string;
  value: number;
  color?: string;
}

// Totales, donut por estado, barras por urgencia y tendencia de 14 días, en
// un solo pase sobre los tickets (en vez de ~10 .filter() separados).
export function resumenTickets(tickets: Ticket[]) {
  const porStatus: Record<string, number> = {};
  const porUrgencia: Record<string, number> = {};
  // Agrupado por día (clave yyyy-MM-dd), en vez de filtrar una vez por día.
  const porDia: Record<string, number> = {};
  for (const t of tickets) {
    porStatus[t.status] = (porStatus[t.status] ?? 0) + 1;
    porUrgencia[t.urgency] = (porUrgencia[t.urgency] ?? 0) + 1;
    if (t.createdAt instanceof Timestamp) {
      const clave = format(t.createdAt.toDate(), "yyyy-MM-dd");
      porDia[clave] = (porDia[clave] ?? 0) + 1;
    }
  }

  const total = tickets.length;
  const terminados = porStatus["terminado"] ?? 0;

  const statusData: Dato[] = [
    { name: "Pendiente", value: porStatus["pendiente"] ?? 0, color: "#64748b" },
    { name: "Asignado", value: porStatus["asignado"] ?? 0, color: "#3b82f6" },
    { name: "En Proceso", value: porStatus["en_proceso"] ?? 0, color: "#9333ea" },
    { name: "Terminado", value: terminados, color: "#16a34a" },
  ].filter((d) => d.value > 0);

  const urgencyData: Dato[] = [
    { name: "Bajo", value: porUrgencia["BAJO"] ?? 0, color: "#16a34a" },
    { name: "Medio", value: porUrgencia["MEDIO"] ?? 0, color: "#ca8a04" },
    { name: "Alto", value: porUrgencia["ALTO"] ?? 0, color: "#ea580c" },
    { name: "Crítico", value: porUrgencia["CRITICO"] ?? 0, color: "#dc2626" },
  ];

  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return { name: format(date, "dd MMM", { locale: es }), tickets: porDia[format(date, "yyyy-MM-dd")] ?? 0 };
  });

  return {
    total,
    pendientes: porStatus["pendiente"] ?? 0,
    enProceso: (porStatus["en_proceso"] ?? 0) + (porStatus["asignado"] ?? 0),
    terminados,
    resueltoPct: total ? Math.round((terminados / total) * 100) : 0,
    statusData,
    urgencyData,
    last14Days,
  };
}

// Conteo por clave, ordenado de mayor a menor y recortado a los `max` primeros.
function topPorClave(tickets: Ticket[], clave: (t: Ticket) => string, max: number): Dato[] {
  const map = new Map<string, number>();
  for (const t of tickets) map.set(clave(t), (map.get(clave(t)) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

export const ticketsPorEmpleado = (tickets: Ticket[], empleados: Empleado[]) =>
  topPorClave(tickets, (t) => empleados.find((e) => e.id === t.assignedTo)?.nombre || "Sin asignar", 6);

export const ticketsPorCategoria = (tickets: Ticket[]) => topPorClave(tickets, (t) => t.categoria || "Sin categoría", 8);

// Resolución y SLA por área: tiempo promedio (registro → terminado) y
// cuántos tickets abiertos ya pasaron su plazo.
export function ticketsPorArea(tickets: Ticket[], sla: SlaHoras) {
  const grupos = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const area = t.area || "Sin área";
    grupos.set(area, [...(grupos.get(area) ?? []), t]);
  }
  return [...grupos.entries()]
    .map(([area, lista]) => ({
      area,
      total: lista.length,
      terminados: lista.filter((t) => t.status === "terminado").length,
      promedio: promedioResolucionMs(lista),
      vencidos: lista.filter((t) => t.status !== "terminado" && estaVencido(t, sla)).length,
    }))
    .sort((a, b) => b.total - a.total);
}

export type FilaPorArea = ReturnType<typeof ticketsPorArea>[number];
