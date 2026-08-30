import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ticketsService } from "../../services/ticketsService";
import { empleadosService } from "../../services/empleadosService";
import { usersService } from "../../services/usersService";
import type { Ticket } from "../../types/ticket";
import type { Empleado } from "../../types/empleado";
import type { User } from "../../types/user";
import { UrgencyBadge } from "../../components/tickets/UrgencyBadge";
import { StatusBadge } from "../../components/tickets/StatusBadge";
import { ComentariosPanel } from "../../components/tickets/ComentariosPanel";
import { ActividadPanel } from "../../components/tickets/ActividadPanel";
import { eventosService } from "../../services/eventosService";
import type { TicketEvento } from "../../types/evento";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ExpandableText } from "../../components/ui/expandable-text";
import { PageSpinner } from "../../components/ui/spinner";
import { IconPencil as Pencil, IconArrowLeft as ArrowLeft, IconCalendar as Calendar, IconUser as UserIcon, IconHash as Hash, IconClock as Clock, IconRobot as Bot, IconRefresh as RefreshCw, IconCircleCheck as CircleCheck } from "@tabler/icons-react";
import { fmtFechaHora } from "../../lib/fecha";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";
import { cn } from "../../lib/cn";

// Sentinel usado cuando un ticket se crea de forma automática (sin usuario humano detrás).
const IA_CREATED_BY = "ia-assistant";

export const TicketDetail: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = esAdmin(user?.role);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [eventos, setEventos] = useState<TicketEvento[]>([]);
  const [loading, setLoading] = useState(true);
  // empleados/usuarios se cargan aparte del ticket (fetch normal, no listener) y
  // tardan mas — sin esto la pagina se pinta apenas llega el ticket, con esas
  // listas todavia vacias, y muestra el id crudo de assignedTo y "Creado por"
  // en rojo (como cuenta eliminada) durante ese lapso hasta que resuelven.
  const [empleadosListos, setEmpleadosListos] = useState(false);
  const [usuariosListos, setUsuariosListos] = useState(false);
  const [analizando, setAnalizando] = useState(false);
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
    empleadosService.getAll().then(setEmpleados).catch(() => {}).finally(() => setEmpleadosListos(true));
    usersService.getAll().then(setUsuarios).catch(() => {}).finally(() => setUsuariosListos(true));
    return unsubscribe;
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    return eventosService.watch(id, setEventos);
  }, [id]);

  const ejecutarAnalisis = async () => {
    if (!id) return;
    setAnalizando(true);
    try {
      const resultado = await ticketsService.reanalizarIA(id);
      if (resultado.ok) {
        notificarExito("La IA analizó el ticket y asignó personal");
      } else {
        notificarError(resultado.motivo || "La IA no pudo asignar el ticket");
      }
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al analizar con IA");
    } finally {
      setAnalizando(false);
    }
  };

  const handleAnalizar = () => ejecutarAnalisis();

  const handleReanalizar = async () => {
    const ok = await confirmar({
      title: "¿Reanalizar con IA?",
      text: "Esto reemplazará la asignación actual (área y personal) por la que determine la IA.",
      confirmText: "Reanalizar",
      danger: true,
    });
    if (ok) await ejecutarAnalisis();
  };

  if (loading || !empleadosListos || !usuariosListos) return <PageSpinner />;

  if (!ticket) return null;

  const asignado = empleados.find((e) => e.id === ticket.assignedTo);
  const puedeGestionarCierre = isAdmin || (!!ticket.assignedTo && ticket.assignedTo === user?.personalId);
  const esIA = ticket.createdBy === IA_CREATED_BY;
  // El usuario que creó el ticket puede ya no existir (eliminado, soft o
  // definitivo) — ahí se usa el snapshot `createdByUsername` guardado al crear
  // el ticket (tickets viejos sin ese campo caen al id crudo) y se marca en
  // rojo para que se note que esa cuenta ya no está activa.
  const creadorActivo = usuarios.find((u) => u.id === ticket.createdBy);
  const creador = esIA ? "Asistente IA" : creadorActivo?.username || ticket.createdByUsername || ticket.createdBy;
  const creadorEliminado = !esIA && !creadorActivo;

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="flex items-center gap-2">
          {isAdmin && !ticket.assignedTo && (
            <Button variant="secondary" onClick={handleAnalizar} disabled={analizando}>
              <Bot className="h-4 w-4" />
              {analizando ? "Analizando..." : "Analizar con IA"}
            </Button>
          )}
          {isAdmin && ticket.assignedTo && (ticket.status === "asignado" || ticket.status === "en_proceso") && (
            <Button variant="secondary" onClick={handleReanalizar} disabled={analizando}>
              <RefreshCw className="h-4 w-4" />
              {analizando ? "Analizando..." : "Reanalizar con IA"}
            </Button>
          )}
          <Link to={`/tickets/${ticket.id}/editar`} state={{ from: "detalle" }}>
            <Button>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </Link>
          {puedeGestionarCierre && (
            <Link to={`/tickets/${ticket.id}/cerrar`}>
              <Button variant="secondary">
                <CircleCheck className="h-4 w-4" />
                Cerrar Ticket
              </Button>
            </Link>
          )}
        </div>
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
                {!!ticket.problemImages?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticket.problemImages.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="h-20 w-20 rounded-md border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {ticket.solutionDescription && (
                <div className="border-t pt-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider">
                    Solución
                  </h3>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{ticket.solutionDescription}</p>
                  {!!ticket.solutionImages?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ticket.solutionImages.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="h-20 w-20 rounded-md border object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-8 border-t pt-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center text-sm">
                    <Calendar className="mr-3 h-4 w-4 text-primary" />
                    <span className="mr-2 font-medium">Fecha y hora del incidente:</span>
                    {fmtFechaHora(ticket.incidentTime)}
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="mr-3 h-4 w-4" />
                    <span className="mr-2 font-medium">Registrado el:</span>
                    {fmtFechaHora(ticket.createdAt)}
                  </div>
                  {ticket.finishedAt && (
                    <div className="flex items-center text-sm">
                      <Calendar className="mr-3 h-4 w-4 text-green-600" />
                      <span className="mr-2 font-medium">Finalizado el:</span>
                      {fmtFechaHora(ticket.finishedAt)}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center text-sm">
                    <UserIcon className="mr-3 h-4 w-4 text-primary" />
                    <span className="mr-2 font-medium">Asignado a:</span>
                    {asignado ? asignado.nombre : ticket.assignedTo ? "Empleado eliminado" : "No asignado"}
                  </div>
                  {ticket.assignedTo && ticket.assignedAt && (
                    <div className="flex items-center text-sm">
                      <Clock className="mr-3 h-4 w-4" />
                      <span className="mr-2 font-medium">Asignado el:</span>
                      {fmtFechaHora(ticket.assignedAt)}
                    </div>
                  )}
                  <div className="flex items-center text-sm">
                    <UserIcon className="mr-3 h-4 w-4" />
                    <span className="mr-2 font-medium">Creado por:</span>
                    <span className={cn(creadorEliminado && "text-destructive")}>
                      {creador}
                      {creadorEliminado}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <ActividadPanel eventos={eventos} />
        </div>
        <ComentariosPanel ticketId={ticket.id} eventos={eventos} className="lg:col-span-2" />
      </div>
    </div>
  );
};
