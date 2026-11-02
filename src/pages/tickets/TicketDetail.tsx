import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticketsService } from "../../services/ticketsService";
import { usersService } from "../../services/usersService";
import type { Ticket } from "../../types/ticket";
import type { User } from "../../types/user";
import { useCatalogos } from "../../context/CatalogosContext";
import { UrgencyBadge } from "../../components/tickets/UrgencyBadge";
import { StatusBadge } from "../../components/tickets/StatusBadge";
import { ComentariosPanel } from "../../components/tickets/ComentariosPanel";
import { ActividadPanel } from "../../components/tickets/ActividadPanel";
import { eventosService } from "../../services/eventosService";
import { IA_CREATED_BY } from "../../lib/historial";
import type { TicketEvento } from "../../types/evento";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ExpandableText } from "../../components/ui/expandable-text";
import { PageSpinner } from "../../components/ui/spinner";
import { IconArrowLeft as ArrowLeft, IconHash as Hash } from "@tabler/icons-react";
import { notificarError } from "../../lib/alertas";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";
import { useTickets } from "../../context/TicketsContext";
import { AccionesDetalleTicket } from "../../components/tickets/AccionesDetalleTicket";
import { DatosTicket } from "../../components/tickets/DatosTicket";
import { ImagenesAdjuntas } from "../../components/ui/image-uploader";

export const TicketDetail: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = esAdmin(user?.role);
  const { sla } = useTickets();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const { empleados, empleadosListos } = useCatalogos();
  const [eventos, setEventos] = useState<TicketEvento[]>([]);
  const [loading, setLoading] = useState(true);
  // Cuenta que creó el ticket (null = ya no existe). `undefined` mientras
  // carga, para no pintar "cuenta eliminada" en rojo durante ese lapso.
  const [creadorCuenta, setCreadorCuenta] = useState<{ ticketId: string; user: User | null } | undefined>(undefined);
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

  const createdBy = ticket?.createdBy;
  useEffect(() => {
    if (!id || !createdBy) return;
    let activo = true;
    const fijar = (u: User | null) => activo && setCreadorCuenta({ ticketId: id, user: u && !u.deletedAt ? u : null });
    if (createdBy === IA_CREATED_BY) fijar(null);
    else usersService.getById(createdBy).then(fijar).catch(() => fijar(null));
    return () => {
      activo = false;
    };
  }, [id, createdBy]);
  const usuariosListos = creadorCuenta?.ticketId === id;

  useEffect(() => {
    if (!id) return;
    const unsubscribe = eventosService.watch(id, setEventos);
    return () => unsubscribe();
  }, [id]);

  if (loading || !empleadosListos || !usuariosListos) return <PageSpinner />;

  if (!ticket) return null;

  const asignado = empleados.find((e) => e.id === ticket.assignedTo);
  const esIA = ticket.createdBy === IA_CREATED_BY;
  // El usuario que creó el ticket puede ya no existir (eliminado, soft o
  // definitivo) — ahí se usa el snapshot `createdByUsername` guardado al crear
  // el ticket (tickets viejos sin ese campo caen al id crudo) y se marca en
  // rojo para que se note que esa cuenta ya no está activa.
  const creadorActivo = creadorCuenta?.user;
  const creador = esIA ? "Asistente IA" : creadorActivo?.username || ticket.createdByUsername || ticket.createdBy;
  const creadorEliminado = !esIA && !creadorActivo;

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <AccionesDetalleTicket ticket={ticket} esAdmin={isAdmin} miPersonalId={user?.personalId} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card className="shrink-0 overflow-hidden">
            <div className="flex flex-col justify-between gap-4 border-b bg-muted/40 p-6 sm:flex-row sm:items-center">
              <div>
                <div className="mb-1 flex items-center gap-2 text-lg font-bold text-primary">
                  <Hash className="h-5 w-5" />
                  <span>{ticket.code}</span>
                </div>
                <h1 className="text-2xl font-bold uppercase">{ticket.title}</h1>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Estado:</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Urgencia:</span>
                  <UrgencyBadge urgency={ticket.urgency} />
                </div>
              </div>
            </div>

            <div className="space-y-8 p-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider">
                  Descripción
                </h3>
                <ExpandableText
                  texto={ticket.description}
                  maxChars={425}
                  className="whitespace-pre-wrap break-words leading-relaxed"
                />
                <ImagenesAdjuntas urls={ticket.problemImages} className="mt-3" />
              </div>

              {ticket.solutionDescription && (
                <div className="border-t pt-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider">
                    Solución
                  </h3>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{ticket.solutionDescription}</p>
                  <ImagenesAdjuntas urls={ticket.solutionImages} className="mt-3" />
                </div>
              )}

              <DatosTicket
                ticket={ticket}
                sla={sla}
                asignado={asignado}
                creador={creador}
                creadorEliminado={creadorEliminado}
              />
            </div>
          </Card>
          <ActividadPanel eventos={eventos} />
        </div>
        <ComentariosPanel ticketId={ticket.id} eventos={eventos} className="lg:col-span-2" />
      </div>
    </div>
  );
};
