import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import type { FirestoreTimestamp } from "../types/firestore";

function toDate(value: FirestoreTimestamp | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Fecha + hora en formato 12h (ej. "28/05/2026 03:45 p. m.")
export function fmtFechaHora(value: FirestoreTimestamp | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM/yyyy hh:mm a", { locale: es }) : "-";
}

// Versión corta para tablas (ej. "28/05 03:45 p. m.")
export function fmtFechaCorta(value: FirestoreTimestamp | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM hh:mm a", { locale: es }) : "-";
}

// Perú (America/Lima) es UTC-5 fijo, sin horario de verano.
const OFFSET_LIMA = "-05:00";

// "Ahora", como string para un <input type="datetime-local">, en hora de Lima
// (no la hora local del navegador/SO de quien esté usando la app).
export function ahoraLimaInputValue(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = fmt.formatToParts(date);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Convierte el string de un <input type="datetime-local"> (interpretado como
// hora de Lima) a un Date real — sin esto, `new Date(string)` lo interpreta
// con la zona horaria del navegador de quien esté usando la app, no la de Perú.
export function limaInputValueToDate(value: string): Date {
  return new Date(`${value}:00${OFFSET_LIMA}`);
}
