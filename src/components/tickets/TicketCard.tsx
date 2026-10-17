import React from "react";
import { IconUser as User } from "@tabler/icons-react";
import type { Ticket } from "../../types/ticket";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { StatusBadge } from "./StatusBadge";
import { UrgencyBadge } from "./UrgencyBadge";
import { fmtFechaHora } from "../../lib/fecha";

interface Props {
  ticket: Ticket;
  numero: number;
  soloPapelera: boolean;
  vencido: boolean;
  asignado: string;
  acciones: React.ReactNode;
}

// Card de ticket de la grilla de Tickets y de la Papelera. Orden fijo de
// filas: 1 contador + código + estado, 2 título, 3 descripción, 4 urgencia +
// hora, 5 asignado. Texto en un solo color (foreground) — la jerarquía se
// marca solo con font-bold.
export const TicketCard: React.FC<Props> = ({ ticket, numero, soloPapelera, vencido, asignado, acciones }) => (
  <Card className="flex flex-col p-5">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {numero}
        </span>
        <span className="text-sm font-bold text-primary">{ticket.code}</span>
      </div>
      {soloPapelera ? (
        <Badge variant="red" dot>
          Eliminado
        </Badge>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold">Estado:</span>
          <StatusBadge status={ticket.status} />
        </div>
      )}
    </div>
    <h3 className="mb-2 line-clamp-2 font-bold uppercase">{ticket.title}</h3>
    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>

    <div className="mt-auto space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold">Urgencia:</span>
          <UrgencyBadge urgency={ticket.urgency} />
          {vencido && <Badge variant="red">Vencido</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{fmtFechaHora(ticket.incidentTime)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        {asignado}
      </div>
      <div className="flex items-center justify-end gap-1 border-t pt-3">{acciones}</div>
    </div>
  </Card>
);
