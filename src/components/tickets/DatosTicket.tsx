import React from "react";
import {
  IconCalendar as Calendar, IconUser as UserIcon, IconClock as Clock, IconTag as Tag, IconHourglass as Hourglass,
} from "@tabler/icons-react";
import { Badge } from "../ui/badge";
import { fmtFechaHora } from "../../lib/fecha";
import { cn } from "../../lib/cn";
import { estaVencido, venceEnMs, type SlaHoras } from "../../lib/sla";
import type { Ticket } from "../../types/ticket";
import type { Empleado } from "../../types/empleado";

// Una fila "ícono + etiqueta: valor".
function Dato({
  icono: Icono,
  colorIcono,
  etiqueta,
  children,
}: {
  icono: React.ComponentType<{ className?: string }>;
  colorIcono?: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center text-sm">
      <Icono className={cn("mr-3 h-4 w-4", colorIcono)} />
      <span className="mr-2 font-medium">{etiqueta}:</span>
      {children}
    </div>
  );
}

// Fechas, SLA, categoría, asignación y creador de un ticket (detalle).
export const DatosTicket: React.FC<{
  ticket: Ticket;
  sla: SlaHoras;
  asignado?: Empleado;
  creador: string;
  creadorEliminado: boolean;
}> = ({ ticket, sla, asignado, creador, creadorEliminado }) => {
  let nombreAsignado = "No asignado";
  if (asignado) nombreAsignado = asignado.nombre;
  else if (ticket.assignedTo) nombreAsignado = "Empleado eliminado";

  return (
    <div className="grid grid-cols-1 gap-8 border-t pt-6 md:grid-cols-2">
      <div className="space-y-4">
        <Dato icono={Calendar} colorIcono="text-primary" etiqueta="Fecha y hora del incidente">
          {fmtFechaHora(ticket.incidentTime)}
        </Dato>
        <Dato icono={Calendar} etiqueta="Registrado el">
          {fmtFechaHora(ticket.createdAt)}
        </Dato>
        {ticket.finishedAt && (
          <Dato icono={Calendar} colorIcono="text-green-600" etiqueta="Finalizado el">
            {fmtFechaHora(ticket.finishedAt)}
          </Dato>
        )}
        {ticket.createdAt && (
          <Dato icono={Hourglass} etiqueta="Vence (SLA)">
            {fmtFechaHora(new Date(venceEnMs(ticket, sla)))}
            {estaVencido(ticket, sla) && (
              <Badge variant="red" className="ml-2">
                {ticket.status === "terminado" ? "Fuera de plazo" : "Vencido"}
              </Badge>
            )}
          </Dato>
        )}
      </div>
      <div className="space-y-4">
        <Dato icono={Tag} etiqueta="Categoría">
          {ticket.categoria || "Sin categoría"}
        </Dato>
        <Dato icono={UserIcon} colorIcono="text-primary" etiqueta="Asignado a">
          {nombreAsignado}
          {asignado && !asignado.activo && (
            <Badge variant="red" className="ml-2" title="Este técnico está desactivado: conviene reasignar el ticket">
              Inactivo
            </Badge>
          )}
        </Dato>
        {ticket.assignedTo && ticket.assignedAt && (
          <Dato icono={Clock} etiqueta="Asignado el">
            {fmtFechaHora(ticket.assignedAt)}
          </Dato>
        )}
        <Dato icono={UserIcon} etiqueta="Creado por">
          <span className={cn(creadorEliminado && "text-destructive")}>{creador}</span>
        </Dato>
      </div>
    </div>
  );
};
