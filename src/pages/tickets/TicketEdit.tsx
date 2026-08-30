import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ticketsService } from "../../services/ticketsService";
import type { Ticket } from "../../types/ticket";
import { TicketForm, type TicketFormData } from "../../components/tickets/TicketForm";
import { PageSpinner } from "../../components/ui/spinner";
import { notificarExito, notificarError } from "../../lib/alertas";
import { limaInputValueToDate } from "../../lib/fecha";

export const TicketEdit: React.FC = () => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Si se entró a editar desde el detalle del ticket, volver ahí al guardar;
  // si se entró desde la lista (Tickets), volver a la lista.
  const vieneDeDetalle = (location.state as { from?: string } | null)?.from === "detalle";

  useEffect(() => {
    if (!id) return;
    ticketsService.getById(id)
      .then(setTicket)
      .catch(() => {
        notificarError("Error al cargar el ticket");
        navigate("/tickets");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (data: TicketFormData) => {
    if (!id) return;
    setSaving(true);
    try {
      const prevAssigned = ticket?.assignedTo || "";
      const nextAssigned = data.assignedTo || "";
      const assignmentChanged = nextAssigned !== prevAssigned;
      // Reabrir un ticket que estaba terminado (moverlo a cualquier otro
      // estado desde acá) limpia la solución vieja — mismo criterio que
      // CierreTicketPanel.
      const reabierto = ticket?.status === "terminado" && data.status !== "terminado";

      await ticketsService.update(id, {
        ...data,
        incidentTime: data.incidentTime ? limaInputValueToDate(data.incidentTime) : new Date(),
        ...(assignmentChanged ? { assignedAt: nextAssigned ? new Date() : null } : {}),
        ...(reabierto ? { solutionDescription: "", solutionImages: [] } : {}),
      });
      notificarExito("Ticket actualizado correctamente");
      navigate(vieneDeDetalle ? `/tickets/${id}` : "/tickets");
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al actualizar el ticket");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  if (!ticket) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Ticket</h1>
        <p className="text-muted-foreground">Actualiza la información del ticket {ticket.code}.</p>
      </div>

      <TicketForm 
        initialData={ticket} 
        onSubmit={handleSubmit} 
        loading={saving} 
      />
    </div>
  );
};
