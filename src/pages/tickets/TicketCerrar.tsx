import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticketsService } from "../../services/ticketsService";
import type { Ticket } from "../../types/ticket";
import { CierreTicketPanel } from "../../components/tickets/CierreTicketPanel";
import { Button } from "../../components/ui/button";
import { PageSpinner } from "../../components/ui/spinner";
import { IconArrowLeft as ArrowLeft } from "@tabler/icons-react";
import { notificarError } from "../../lib/alertas";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";

export const TicketCerrar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = esAdmin(user?.role);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    const unsubscribe = ticketsService.watchById(id, (data) => {
      if (!data) {
        notificarError("Error al cargar el ticket");
        navigate("/tickets");
        return;
      }
      setTicket(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [id, navigate]);

  // Mismo criterio que firestore.rules (tickets.update de técnico): admin o
  // el propio técnico asignado, y que no tenga ya una solución documentada
  // (mismo criterio que el botón "Cerrar Ticket" en TicketDetail.tsx).
  // Redirige en un efecto, no durante el render.
  const puedeGestionarCierre =
    !!ticket &&
    !ticket.solutionDescription &&
    (isAdmin || (!!ticket.assignedTo && ticket.assignedTo === user?.personalId));
  useEffect(() => {
    if (!ticket || puedeGestionarCierre) return;
    notificarError("No tienes permiso para cerrar este ticket.");
    navigate(`/tickets/${ticket.id}`, { replace: true });
  }, [ticket, puedeGestionarCierre, navigate]);

  if (loading || !ticket || !puedeGestionarCierre) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/tickets/${ticket.id}`)}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cerrar Ticket {ticket.code}</h1>
        <p className="text-muted-foreground">{ticket.title}</p>
      </div>

      <CierreTicketPanel key={ticket.id} ticket={ticket} />
    </div>
  );
};
