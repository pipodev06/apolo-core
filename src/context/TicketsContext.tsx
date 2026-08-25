import React, { createContext, useContext, useEffect, useState } from "react";
import { ticketsService } from "../services/ticketsService";
import type { Ticket } from "../types/ticket";
import { useAuth } from "./AuthContext";

interface TicketsContextType {
  tickets: Ticket[];
  loading: boolean;
}

const TicketsContext = createContext<TicketsContextType | undefined>(undefined);

// Un solo listener de tickets (no-papelera) para toda la sesión, en vez de
// que Dashboard/TicketsList/EmpleadosTab/TicketForm abran cada uno el suyo
// por separado — antes, cada navegación entre pantallas volvía a descargar
// la colección completa desde cero, aunque momentos antes otra pantalla ya
// la tuviera cargada. La vista de Papelera de Tickets sigue con su propio
// fetch en TicketsList.tsx (query distinta: deletedAt != null).
export const TicketsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = ticketsService.watch((data) => {
      setTickets(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return <TicketsContext.Provider value={{ tickets, loading }}>{children}</TicketsContext.Provider>;
};

export const useTickets = () => {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets debe usarse dentro de TicketsProvider");
  return ctx;
};
