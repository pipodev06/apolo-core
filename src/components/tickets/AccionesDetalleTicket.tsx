import React, { useState } from "react";
import { Link } from "react-router-dom";
import { IconPencil as Pencil, IconRobot as Bot, IconRefresh as RefreshCw, IconCircleCheck as CircleCheck } from "@tabler/icons-react";
import { Button } from "../ui/button";
import { ticketsService } from "../../services/ticketsService";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import type { Ticket } from "../../types/ticket";

// Botones del detalle de un ticket: analizar/reanalizar con IA y editar
// (admins), y cerrar (admin o el técnico asignado).
export const AccionesDetalleTicket: React.FC<{ ticket: Ticket; esAdmin: boolean; miPersonalId?: string }> = ({
  ticket,
  esAdmin,
  miPersonalId,
}) => {
  const [analizando, setAnalizando] = useState(false);

  const analizar = async () => {
    setAnalizando(true);
    try {
      const resultado = await ticketsService.reanalizarIA(ticket.id);
      if (resultado.ok) notificarExito("La IA analizó el ticket y asignó personal");
      else notificarError(resultado.motivo || "La IA no pudo asignar el ticket");
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al analizar con IA");
    } finally {
      setAnalizando(false);
    }
  };

  const reanalizar = async () => {
    const ok = await confirmar({
      title: "¿Reanalizar con IA?",
      text: "Esto reemplazará la asignación actual (área y personal) por la que determine la IA.",
      confirmText: "Reanalizar",
      danger: true,
    });
    if (ok) await analizar();
  };

  const abierto = ticket.status === "asignado" || ticket.status === "en_proceso";
  // Con la solución ya documentada, "Cerrar Ticket" deja de ofrecerse:
  // reabrirlo (lo que limpia esa solución) solo se hace desde Editar (admin).
  const puedeCerrar =
    !ticket.solutionDescription && (esAdmin || (!!ticket.assignedTo && ticket.assignedTo === miPersonalId));

  return (
    <div className="flex items-center gap-2">
      {esAdmin && !ticket.assignedTo && (
        <Button variant="secondary" onClick={analizar} disabled={analizando}>
          <Bot className="h-4 w-4" />
          {analizando ? "Analizando..." : "Analizar con IA"}
        </Button>
      )}
      {esAdmin && ticket.assignedTo && abierto && (
        <Button variant="secondary" onClick={reanalizar} disabled={analizando}>
          <RefreshCw className="h-4 w-4" />
          {analizando ? "Analizando..." : "Reanalizar con IA"}
        </Button>
      )}
      {esAdmin && (
        <Link to={`/tickets/${ticket.id}/editar`} state={{ from: "detalle" }}>
          <Button>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </Link>
      )}
      {puedeCerrar && (
        <Link to={`/tickets/${ticket.id}/cerrar`}>
          <Button variant="secondary">
            <CircleCheck className="h-4 w-4" />
            Cerrar Ticket
          </Button>
        </Link>
      )}
    </div>
  );
};
