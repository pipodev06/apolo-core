import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ticketsService } from "../../services/ticketsService";
import { useAuth } from "../../context/AuthContext";
import { TicketForm, type TicketFormData } from "../../components/tickets/TicketForm";
import { notificarExito, notificarError } from "../../lib/alertas";
import { limaInputValueToDate } from "../../lib/fecha";

export const TicketNew: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (data: TicketFormData) => {
    if (!user) return;
    setLoading(true);
    try {
      await ticketsService.create({
        ...data,
        incidentTime: data.incidentTime ? limaInputValueToDate(data.incidentTime) : new Date(),
        createdBy: user.userId,
        createdByUsername: user.username,
      });
      notificarExito("Ticket creado correctamente");
      navigate("/tickets");
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Nuevo Ticket</h1>
        <p className="text-gray-800 dark:text-gray-100">Registra una nueva incidencia en el sistema.</p>
      </div>

      <TicketForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
};
