import React from "react";
import type { Urgency } from "../../types/ticket";
import { Badge } from "../ui/badge";

export const UrgencyBadge: React.FC<{ urgency: Urgency }> = ({ urgency }) => {
  const configs = {
    CRITICO: { variant: "red", label: "CRÍTICO" },
    ALTO: { variant: "orange", label: "ALTO" },
    MEDIO: { variant: "yellow", label: "MEDIO" },
    BAJO: { variant: "green", label: "BAJO" },
  } as const;

  const { variant, label } = configs[urgency];

  return <Badge variant={variant}>{label}</Badge>;
};
