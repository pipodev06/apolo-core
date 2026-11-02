import React from "react";
import type { TicketStatus } from "../../types/ticket";
import { Badge } from "../ui/badge";

export const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const configs = {
    // En mayúsculas, igual que UrgencyBadge: las dos pastillas del ticket
    // se leen con el mismo estilo.
    pendiente: { variant: "gray", label: "PENDIENTE" },
    asignado: { variant: "blue", label: "ASIGNADO" },
    en_proceso: { variant: "purple", label: "EN PROCESO" },
    terminado: { variant: "green", label: "TERMINADO" },
  } as const;

  const { variant, label } = configs[status];

  return <Badge variant={variant} dot>{label}</Badge>;
};
