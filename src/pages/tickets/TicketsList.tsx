import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import {
  IconPlus as Plus, IconEye as Eye, IconPencil as Pencil, IconTrash as Trash2, IconSearch as Search, IconTicket as TicketIcon,
  IconUser as User, IconRestore as RotateCcw, IconFilterOff as FilterX,
} from "@tabler/icons-react";
import { ticketsService } from "../../services/ticketsService";
import { empleadosService } from "../../services/empleadosService";
import type { Ticket, Urgency, TicketStatus } from "../../types/ticket";
import type { Empleado } from "../../types/empleado";
import type { FirestoreTimestamp } from "../../types/firestore";
import { Card } from "../../components/ui/card";
import { PageSpinner } from "../../components/ui/spinner";
import { UrgencyBadge } from "../../components/tickets/UrgencyBadge";
import { StatusBadge } from "../../components/tickets/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { fmtFechaHora } from "../../lib/fecha";
import { useAlturaScrollViewport } from "../../lib/useAlturaScrollViewport";

const statusLabels: Record<TicketStatus, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_proceso: "En Proceso",
  terminado: "Terminado",
};

const urgencyLabels: Record<Urgency, string> = {
  CRITICO: "Crítico",
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
};

// Milisegundos de una fecha (soporta Firestore Timestamp o Date/string).
const fechaMs = (t: FirestoreTimestamp | null | undefined): number => {
  if (!t) return 0;
  return t instanceof Timestamp ? t.toDate().getTime() : new Date(t).getTime();
};

interface Props {
  soloPapelera?: boolean;
}

export const TicketsList: React.FC<Props> = ({ soloPapelera = false }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  // Borrador: lo que el usuario va eligiendo antes de aplicar.
  // dEstado/dUrgencia: "" = todos.
  const [dQuery, setDQuery] = useState("");
  const [dEstado, setDEstado] = useState<TicketStatus | "">("");
  const [dUrgencia, setDUrgencia] = useState<Urgency | "">("");
  const [dDesde, setDDesde] = useState("");
  const [dHasta, setDHasta] = useState("");

  // Aplicado: lo que realmente filtra la lista, se actualiza con "Filtrar".
  const [query, setQuery] = useState("");
  const [fEstado, setFEstado] = useState<TicketStatus | "">("");
  const [fUrgencia, setFUrgencia] = useState<Urgency | "">("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  useEffect(() => {
    const unsubscribe = ticketsService.watch((data) => {
      setTickets(data);
      setLoading(false);
    }, soloPapelera);
    return unsubscribe;
  }, [soloPapelera]);

  useEffect(() => {
    empleadosService.getAll().then(setEmpleados).catch(() => {});
  }, []);

  const empleadoNombre = (id?: string) => empleados.find((e) => e.id === id)?.nombre;

  // Cards: solo el contenedor scrollea (viewport estático), ~15px de margen inferior.
  const { ref: cardsRef, style: cardsStyle } = useAlturaScrollViewport(15, [loading]);

  // Orden: última edición primero.
  const ordenados = useMemo(() => {
    return [...tickets].sort((a, b) => fechaMs(b.updatedAt) - fechaMs(a.updatedAt));
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const desde = fDesde ? new Date(fDesde + "T00:00:00").getTime() : -Infinity;
    const hasta = fHasta ? new Date(fHasta + "T23:59:59").getTime() : Infinity;
    return ordenados.filter((t) => {
      if (fEstado && t.status !== fEstado) return false;
      if (fUrgencia && t.urgency !== fUrgencia) return false;
      if (q) {
        const nombre = t.assignedTo ? empleados.find((e) => e.id === t.assignedTo)?.nombre || "" : "";
        const coincide =
          t.code.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || nombre.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      const ms = fechaMs(t.createdAt);
      if (ms < desde || ms > hasta) return false;
      return true;
    });
  }, [ordenados, query, fEstado, fUrgencia, fDesde, fHasta, empleados]);

  const hayFiltrosActivos = !!(query || fEstado || fUrgencia || fDesde || fHasta);

  const aplicarFiltros = () => {
    setQuery(dQuery);
    setFEstado(dEstado);
    setFUrgencia(dUrgencia);
    setFDesde(dDesde);
    setFHasta(dHasta);
  };

  const limpiarFiltros = () => {
    setDQuery("");
    setDEstado("");
    setDUrgencia("");
    setDDesde("");
    setDHasta("");
    setQuery("");
    setFEstado("");
    setFUrgencia("");
    setFDesde("");
    setFHasta("");
  };

  const handleDelete = async (ticket: Ticket) => {
    const ok = await confirmar({
      title: "Eliminar ticket",
      text: `¿Seguro que deseas eliminar ${ticket.code}? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await ticketsService.delete(ticket.id);
      notificarExito("Enviado a la papelera");
    } catch {
      notificarError("Error al eliminar el ticket");
    }
  };

  const restaurar = async (ticket: Ticket) => {
    try {
      await ticketsService.restaurar(ticket.id);
      notificarExito("Ticket restaurado");
    } catch {
      notificarError("Error al restaurar");
    }
  };

  const purgar = async (ticket: Ticket) => {
    const ok = await confirmar({
      title: "Eliminar definitivamente",
      text: `${ticket.code} se borrará para siempre. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar definitivo",
      danger: true,
    });
    if (!ok) return;
    try {
      await ticketsService.eliminarDefinitivo(ticket.id);
      notificarExito("Eliminado definitivamente");
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const acciones = (ticket: Ticket) =>
    soloPapelera ? (
      <>
        <button
          onClick={() => restaurar(ticket)}
          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-green-500/10 hover:text-green-600"
          title="Restaurar"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={() => purgar(ticket)}
          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600"
          title="Eliminar definitivo"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </>
    ) : (
      <>
        <Link
          to={`/tickets/${ticket.id}`}
          title="Ver detalle"
          className="rounded-md p-1.5 text-gray-800 transition-colors hover:bg-gray-100 hover:text-indigo-600"
        >
          <Eye className="h-5 w-5" />
        </Link>
        <Link
          to={`/tickets/${ticket.id}/editar`}
          title="Editar"
          className="rounded-md p-1.5 text-gray-800 transition-colors hover:bg-gray-100 hover:text-indigo-600"
        >
          <Pencil className="h-5 w-5" />
        </Link>
        <button
          onClick={() => handleDelete(ticket)}
          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600"
          title="Eliminar"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </>
    );

  // Card de ticket compartida entre el tablero y la grilla plana de Papelera.
  // Fila 1: contador + código + estado (pastilla). Fila 2: título. Fila 3:
  // descripción. Fila 4: urgencia + hora. Fila 5: asignado.
  // Texto: un solo shade (gray-800) en todo el card — la jerarquía
  // (título vs. resto) se marca solo con font-bold, no con color.
  const renderTicketCard = (ticket: Ticket, index: number) => (
    <Card key={ticket.id} className="flex flex-col border border-gray-200 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {index + 1}
          </span>
          <span className="text-sm font-bold text-indigo-600">{ticket.code}</span>
        </div>
        {soloPapelera ? (
          <Badge variant="red" dot>
            Eliminado
          </Badge>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-800">Estado:</span>
            <StatusBadge status={ticket.status} />
          </div>
        )}
      </div>
      <h3 className="mb-2 line-clamp-2 font-bold uppercase text-gray-800">{ticket.title}</h3>
      <p className="mb-4 line-clamp-2 text-sm text-gray-800">{ticket.description}</p>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-800">Urgencia:</span>
            <UrgencyBadge urgency={ticket.urgency} />
          </div>
          <span className="text-xs text-gray-800">{fmtFechaHora(ticket.incidentTime)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-800">
          <User className="h-4 w-4" />
          {empleadoNombre(ticket.assignedTo) || "Sin asignar"}
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-gray-200 pt-3">
          {acciones(ticket)}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-2">
      {!soloPapelera && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-800">Tickets</h1>
          </div>
          <Link to="/tickets/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo Ticket
            </Button>
          </Link>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-800">Estado:</span>
          <Select
            items={[{ value: "__all__", label: "Todos" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]}
            value={dEstado || "__all__"}
            onValueChange={(v) => setDEstado(v === "__all__" || v == null ? "" : (v as TicketStatus))}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">Todos</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-800">Urgencia:</span>
          <Select
            items={[{ value: "__all__", label: "Todas" }, ...Object.entries(urgencyLabels).map(([value, label]) => ({ value, label }))]}
            value={dUrgencia || "__all__"}
            onValueChange={(v) => setDUrgencia(v === "__all__" || v == null ? "" : (v as Urgency))}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">Todas</SelectItem>
                {Object.entries(urgencyLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-55 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-800" />
            <Input
              type="text"
              value={dQuery}
              onChange={(e) => setDQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-800">Desde:</span>
          <Input
            type="date"
            value={dDesde}
            onChange={(e) => setDDesde(e.target.value)}
            className="sm:w-40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-800">Hasta:</span>
          <Input
            type="date"
            value={dHasta}
            onChange={(e) => setDHasta(e.target.value)}
            className="sm:w-40"
          />
        </div>
        <Button onClick={aplicarFiltros}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
        {hayFiltrosActivos && (
          <Button variant="outline" onClick={limpiarFiltros} title="Limpiar filtros">
            <FilterX className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center">
          <TicketIcon className="mx-auto mb-4 h-12 w-12 text-gray-800" />
          <h3 className="text-lg font-medium text-gray-800">
            {soloPapelera ? "Papelera vacía" : "No hay tickets"}
          </h3>
          <p className="text-gray-800">
            {soloPapelera
              ? "No hay tickets eliminados."
              : hayFiltrosActivos
              ? "Ningún ticket coincide con la búsqueda."
              : "Crea tu primer ticket para empezar."}
          </p>
        </div>
      ) : (
        <div ref={cardsRef} style={cardsStyle} className="pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((ticket, i) => renderTicketCard(ticket, i))}
          </div>
        </div>
      )}
    </div>
  );
};
