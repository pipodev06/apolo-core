import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ImageUploader } from "../ui/image-uploader";
import { ticketsService } from "../../services/ticketsService";
import { transicionEstadoValida } from "../../lib/ticketStatus";
import { notificarExito, notificarError } from "../../lib/alertas";
import type { Ticket, TicketStatus } from "../../types/ticket";

const TODOS_LOS_ESTADOS: { value: TicketStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "asignado", label: "Asignado" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "terminado", label: "Terminado" },
];

// Panel separado del formulario de Editar Ticket (que sigue siendo solo-admin,
// con control total): esto lo puede usar también el técnico asignado a SU
// propio ticket (ver firestore.rules, tickets.update para personalId), y solo
// puede tocar estado + solución + imágenes de solución — nunca título,
// descripción, urgencia ni asignación.
//
// El padre (TicketDetail) debe montar esto con key={ticket.id} — así React
// resetea el estado local solo al cambiar de ticket (remount), sin pisar lo
// que el usuario esté escribiendo si algo más actualiza el doc en vivo
// mientras tiene el panel abierto (evita un setState síncrono en un efecto).
export const CierreTicketPanel: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [solutionDescription, setSolutionDescription] = useState(ticket.solutionDescription ?? "");
  const [solutionImages, setSolutionImages] = useState<string[]>(ticket.solutionImages ?? []);
  const [guardando, setGuardando] = useState(false);

  const estadosDisponibles = TODOS_LOS_ESTADOS.filter((e) => transicionEstadoValida(ticket.status, e.value));
  const requiereSolucion = status === "terminado";
  const puedeGuardar = !requiereSolucion || solutionDescription.trim().length > 0;

  // Reabrir un ticket que ya estaba terminado (pasarlo a cualquier otro
  // estado) limpia la solución vieja — no tendría sentido dejar la
  // descripción/imágenes de una solución que ya no aplica una vez reabierto.
  const reabierto = ticket.status === "terminado" && status !== "terminado";

  const guardar = async () => {
    if (!puedeGuardar) {
      notificarError("Escribe una descripción de la solución para cerrar el ticket.");
      return;
    }
    setGuardando(true);
    try {
      await ticketsService.update(ticket.id, {
        status,
        solutionDescription: reabierto ? "" : solutionDescription.trim(),
        solutionImages: reabierto ? [] : solutionImages,
      });
      notificarExito("Ticket actualizado");
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al actualizar el ticket");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider">Cerrar / Actualizar Ticket</h3>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Estado</label>
        <Select items={estadosDisponibles} value={status} onValueChange={(v) => v && setStatus(v as TicketStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {estadosDisponibles.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Descripción de la solución {requiereSolucion && <span className="text-destructive">*</span>}
        </label>
        <Textarea
          value={solutionDescription}
          onChange={(e) => setSolutionDescription(e.target.value)}
          rows={4}
          placeholder="Describe cómo se resolvió el problema..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Imágenes de la solución</label>
        <ImageUploader
          value={solutionImages}
          onChange={setSolutionImages}
          pathPrefix={`tickets/${ticket.id}/solucion`}
        />
      </div>

      <Button onClick={guardar} disabled={guardando} className="w-full">
        {guardando ? "Guardando..." : "Guardar"}
      </Button>
    </Card>
  );
};
