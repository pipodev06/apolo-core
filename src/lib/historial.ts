import type { Ticket } from "../types/ticket";
import { STATUS_LABELS, URGENCY_LABELS } from "./ticketStatus";

// createdBy de los tickets creados de forma automática: no hay un usuario
// real al que notificar.
export const IA_CREATED_BY = "ia-assistant";

// Un cambio de ticket para el historial. clave "asignacion": avisa también
// al técnico asignado (el resto solo al creador).
export interface CambioTicket {
  mensaje: string;
  clave?: "asignacion";
}

export function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

// Mensajes del historial para un cambio de ticket, en el orden en que se
// muestran: la asignación primero (al reasignar, el cambio de estado que la
// acompaña se lee como consecuencia de ella). `nombre` resuelve el id de
// empleado a su nombre.
export function cambiosDeTicket(
  antes: Partial<Ticket>,
  despues: Partial<Ticket>,
  nombre: (personalId: string | undefined) => string
): CambioTicket[] {
  const cambios: CambioTicket[] = [];

  if ((antes.assignedTo ?? "") !== (despues.assignedTo ?? "")) {
    const mensaje = !despues.assignedTo
      ? `Asignación removida (estaba asignado a ${nombre(antes.assignedTo)})`
      : antes.assignedTo
        ? `Reasignado de ${nombre(antes.assignedTo)} a ${nombre(despues.assignedTo)}`
        : `Asignado a ${nombre(despues.assignedTo)}`;
    cambios.push({ mensaje, clave: "asignacion" });
  }
  if (antes.status !== despues.status && despues.status) {
    const de = antes.status ? STATUS_LABELS[antes.status] : "—";
    cambios.push({ mensaje: `Estado: ${de} → ${STATUS_LABELS[despues.status]}` });
  }
  if (antes.urgency !== despues.urgency && despues.urgency) {
    const de = antes.urgency ? URGENCY_LABELS[antes.urgency] : "—";
    cambios.push({ mensaje: `Urgencia: ${de} → ${URGENCY_LABELS[despues.urgency]}` });
  }
  if ((antes.categoria ?? "") !== (despues.categoria ?? "")) {
    cambios.push({ mensaje: despues.categoria ? `Categoría: ${despues.categoria}` : "Categoría quitada" });
  }
  if (antes.solutionDescription !== despues.solutionDescription && despues.solutionDescription) {
    cambios.push({ mensaje: "Solución agregada" });
  }
  return cambios;
}

export const mensajeComentario = (autor: string, texto: string) => `${autor} comentó: "${truncar(texto, 120)}"`;
export const mensajeTicketNuevo = (titulo: string) => `Nuevo ticket: ${truncar(titulo, 100)}`;
