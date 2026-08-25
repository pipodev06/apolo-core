import React from "react";
import type { TicketStatus } from "../../types/ticket";
import { Badge } from "../ui/badge";

export const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const configs = {
    pendiente: { variant: "gray", label: "Pendiente" },
    asignado: { variant: "blue", label: "Asignado" },
    en_proceso: { variant: "purple", label: "En Proceso" },
    terminado: { variant: "green", label: "Terminado" },
  } as const;

  const { variant, label } = configs[status];

  return <Badge variant={variant} dot>{label}</Badge>;
};
