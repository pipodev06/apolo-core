import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconPlus as Plus, IconEye as Eye, IconPencil as Pencil, IconTrash as Trash2, IconSearch as Search, IconTicket as TicketIcon,
  IconFilterOff as FilterX, IconDownload as Download,
} from "@tabler/icons-react";
import { ticketsService } from "../../services/ticketsService";
import { empleadosService } from "../../services/empleadosService";
import { useTickets } from "../../context/TicketsContext";
import type { Ticket, Urgency, TicketStatus } from "../../types/ticket";
import type { Empleado } from "../../types/empleado";
import { PageSpinner } from "../../components/ui/spinner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { fmtFechaHora } from "../../lib/fecha";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";
import { estaVencido, fechaMs, fmtDuracion, tiempoResolucionMs } from "../../lib/sla";
import { descargarCsv } from "../../lib/csv";
import { AccionesFila } from "../../components/ui/acciones-fila";
import { useAlturaScrollViewport } from "../../lib/useAlturaScrollViewport";
import { TicketCard } from "../../components/tickets/TicketCard";

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

interface Props {
  soloPapelera?: boolean;
}

export const TicketsList: React.FC<Props> = ({ soloPapelera = false }) => {
  // Tickets activos vienen de TicketsProvider (App.tsx, un solo listener
  // compartido por sesión). La Papelera es una query distinta (deletedAt !=
  // null) que no vale la pena mantener siempre viva — sigue con su propio
  // listener, solo mientras esta vista está montada.
  const { user } = useAuth();
  const isAdmin = esAdmin(user?.role);
  const { tickets: ticketsActivos, loading: loadingActivos, sla } = useTickets();
  const [ticketsPapelera, setTicketsPapelera] = useState<Ticket[]>([]);
  const [loadingPapelera, setLoadingPapelera] = useState(true);
  const tickets = soloPapelera ? ticketsPapelera : ticketsActivos;
  const loading = soloPapelera ? loadingPapelera : loadingActivos;

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  // Empleados se carga aparte de tickets (fetch normal, no listener) y tarda
  // mas — sin esto la lista se pinta con "Sin asignar" en cada card hasta
  // que resuelve, aunque el ticket si tenga assignedTo. Mismo bug que en
  // TicketDetail.tsx.
  const [empleadosListos, setEmpleadosListos] = useState(false);

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
    if (!soloPapelera || !user) return;
    const unsubscribe = ticketsService.watch(
      user,
      (data) => {
        setTicketsPapelera(data);
        setLoadingPapelera(false);
      },
      true,
      () => setLoadingPapelera(false)
    );
    return () => unsubscribe();
  }, [soloPapelera, user]);

  useEffect(() => {
    empleadosService.getAll().then(setEmpleados).catch(() => {}).finally(() => setEmpleadosListos(true));
  }, []);

  const empleadoNombre = (id?: string) => empleados.find((e) => e.id === id)?.nombre;

  // Cards: solo el contenedor scrollea (viewport estático), ~15px de margen inferior.
  const { ref: cardsRef, style: cardsStyle } = useAlturaScrollViewport(15, [loading, empleadosListos]);

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
          t.code.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          nombre.toLowerCase().includes(q) ||
          (t.categoria ?? "").toLowerCase().includes(q);
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

  // Exporta lo que está filtrado en pantalla.
  const exportar = () => {
    descargarCsv(
      `tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Código", "Título", "Estado", "Urgencia", "Categoría", "Área", "Asignado a", "Registrado", "Terminado", "Tiempo de resolución", "SLA"],
      filtered.map((t) => [
        t.code,
        t.title,
        statusLabels[t.status],
        urgencyLabels[t.urgency],
        t.categoria ?? "",
        t.area ?? "",
        t.assignedTo ? empleadoNombre(t.assignedTo) || "Empleado eliminado" : "Sin asignar",
        fmtFechaHora(t.createdAt),
        fmtFechaHora(t.finishedAt),
        fmtDuracion(tiempoResolucionMs(t)),
        estaVencido(t, sla) ? "Vencido" : "En plazo",
      ])
    );
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
      <AccionesFila soloPapelera onRestaurar={() => restaurar(ticket)} onPurgar={() => purgar(ticket)} />
    ) : (
      <>
        <Link
          to={`/tickets/${ticket.id}`}
          title="Ver detalle"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <Eye className="h-5 w-5" />
        </Link>
        {/* Editar/eliminar son de gestión: firestore.rules solo los permite a admins. */}
        {isAdmin && (
          <>
            <Link
              to={`/tickets/${ticket.id}/editar`}
              title="Editar"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <Pencil className="h-5 w-5" />
            </Link>
            <button
              onClick={() => handleDelete(ticket)}
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Eliminar"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </>
        )}
      </>
    );

  return (
    <div className="space-y-2">
      {!soloPapelera && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportar} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Link to="/tickets/nuevo">
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo Ticket
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Estado:</span>
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
          <span className="text-xs text-muted-foreground">Urgencia:</span>
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          <span className="text-xs text-muted-foreground">Desde:</span>
          <Input
            type="date"
            value={dDesde}
            onChange={(e) => setDDesde(e.target.value)}
            className="sm:w-40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Hasta:</span>
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

      {loading || !empleadosListos ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card py-12 text-center">
          <TicketIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">
            {soloPapelera ? "Papelera vacía" : "No hay tickets"}
          </h3>
          <p className="text-muted-foreground">
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
            {filtered.map((ticket, i) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                numero={i + 1}
                soloPapelera={soloPapelera}
                vencido={!soloPapelera && ticket.status !== "terminado" && estaVencido(ticket, sla)}
                // empleadosService.getAll() incluye inactivos (solo excluye
                // eliminados): assignedTo seteado que no aparece = empleado
                // eliminado, no "sin asignar".
                asignado={ticket.assignedTo ? empleadoNombre(ticket.assignedTo) || "Empleado eliminado" : "Sin asignar"}
                acciones={acciones(ticket)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
