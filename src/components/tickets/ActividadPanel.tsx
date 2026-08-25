import React, { useMemo } from "react";
import { IconHistory as History } from "@tabler/icons-react";
import type { TicketEvento } from "../../types/evento";
import { Card } from "../ui/card";
import { fmtFechaHora } from "../../lib/fecha";
import { cn } from "../../lib/cn";

export const ActividadPanel: React.FC<{ eventos: TicketEvento[]; className?: string }> = ({
  eventos,
  className,
}) => {
  const actividad = useMemo(() => eventos.filter((e) => e.tipo === "sistema"), [eventos]);

  return (
    <Card className={cn("flex h-full flex-col p-6", className)}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
        Actividad
      </h3>

      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {actividad.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>
        )}
        {actividad.map((evento) => (
          <div key={evento.id} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm">{evento.mensaje}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{fmtFechaHora(evento.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
