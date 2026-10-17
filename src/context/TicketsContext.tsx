import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ticketsService } from "../services/ticketsService";
import type { Ticket } from "../types/ticket";
import { useAuth } from "./AuthContext";
import { configService } from "../services/configService";
import { SLA_DEFAULT, type SlaHoras } from "../lib/sla";

interface TicketsContextType {
  tickets: Ticket[];
  loading: boolean;
  // SLA por urgencia de config/app (o SLA_DEFAULT) — se carga una vez por sesión.
  sla: SlaHoras;
}

const SIN_TICKETS: Ticket[] = [];

const TicketsContext = createContext<TicketsContextType | undefined>(undefined);

// Un solo listener de tickets (no-papelera) para toda la sesión, en vez de
// que Dashboard/TicketsList/EmpleadosTab/TicketForm abran cada uno el suyo
// por separado — antes, cada navegación entre pantallas volvía a descargar
// la colección completa desde cero, aunque momentos antes otra pantalla ya
// la tuviera cargada. La vista de Papelera de Tickets sigue con su propio
// fetch en TicketsList.tsx (query distinta: deletedAt != null).
export const TicketsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Tickets etiquetados con el usuario para el que se cargaron: tras un
  // logout/login con otra cuenta, no se muestran (ni un render) los del anterior.
  const [cargados, setCargados] = useState<{ userId: string; tickets: Ticket[] } | null>(null);
  const [sla, setSla] = useState<SlaHoras>(SLA_DEFAULT);

  useEffect(() => {
    if (!user) return;
    let activo = true;
    configService
      .getAppConfig()
      .then((c) => {
        if (activo) setSla({ ...SLA_DEFAULT, ...c.slaHoras });
      })
      .catch(() => {});
    const unsubscribe = ticketsService.watch(
      user,
      (data) => setCargados({ userId: user.userId, tickets: data }),
      false,
      () => setCargados((prev) => (prev?.userId === user.userId ? prev : { userId: user.userId, tickets: [] }))
    );
    return () => {
      activo = false;
      unsubscribe();
    };
  }, [user]);

  const listos = !!user && cargados?.userId === user.userId;
  const tickets = listos ? cargados.tickets : SIN_TICKETS;
  const loading = !!user && !listos;
  const value = useMemo(() => ({ tickets, loading, sla }), [tickets, loading, sla]);
  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
};

export const useTickets = () => {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets debe usarse dentro de TicketsProvider");
  return ctx;
};
