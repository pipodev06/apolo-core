import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconPlus as Plus, IconTicket as TicketIcon, IconDownload as Download } from "@tabler/icons-react";
import { ticketsService } from "../../services/ticketsService";
import { useTickets } from "../../context/TicketsContext";
import { useCatalogos } from "../../context/CatalogosContext";
import type { Ticket } from "../../types/ticket";
import { PageSpinner } from "../../components/ui/spinner";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";
import { estaVencido, fechaMs } from "../../lib/sla";
import { useAlturaScrollViewport } from "../../lib/useAlturaScrollViewport";
import { TicketCard } from "../../components/tickets/TicketCard";
import { FiltrosTickets } from "../../components/tickets/FiltrosTickets";
import { AccionesTicket } from "../../components/tickets/AccionesTicket";
import {
  FILTROS_VACIOS,
  exportarTicketsCsv,
  filtrarTickets,
  hayFiltrosActivos,
  type FiltrosTicket,
} from "../../lib/filtrosTickets";

interface Props {
  soloPapelera?: boolean;
}

function ListaVacia({ soloPapelera, conFiltros }: { soloPapelera: boolean; conFiltros: boolean }) {
  let detalle = "Crea tu primer ticket para empezar.";
  if (soloPapelera) detalle = "No hay tickets eliminados.";
  else if (conFiltros) detalle = "Ningún ticket coincide con la búsqueda.";
  return (
    <div className="rounded-lg border border-dashed bg-card py-12 text-center">
      <TicketIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="text-lg font-medium">{soloPapelera ? "Papelera vacía" : "No hay tickets"}</h3>
      <p className="text-muted-foreground">{detalle}</p>
    </div>
  );
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

  // Personal y categorías: un listener compartido por sesión (CatalogosProvider).
  const { empleados, empleadosListos, categorias } = useCatalogos();

  // Filtros aplicados (el borrador vive en FiltrosTickets).
  const [filtros, setFiltros] = useState<FiltrosTicket>(FILTROS_VACIOS);
  const filtrosActivos = hayFiltrosActivos(filtros);

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

  const empleadoNombre = (id?: string) => empleados.find((e) => e.id === id)?.nombre;
  // La lista de personal incluye inactivos (solo excluye eliminados):
  // assignedTo seteado que no aparece = empleado eliminado, no "sin asignar".
  const asignado = (t: Ticket) => (t.assignedTo ? empleadoNombre(t.assignedTo) || "Empleado eliminado" : "Sin asignar");

  // Cards: solo el contenedor scrollea (viewport estático), ~15px de margen inferior.
  const { ref: cardsRef, style: cardsStyle } = useAlturaScrollViewport(15, [loading, empleadosListos]);

  // Orden: última edición primero.
  const filtered = useMemo(() => {
    const ordenados = [...tickets].sort((a, b) => fechaMs(b.updatedAt) - fechaMs(a.updatedAt));
    return filtrarTickets(ordenados, filtros, (id) => empleados.find((e) => e.id === id)?.nombre);
  }, [tickets, filtros, empleados]);

  // Opciones del filtro: categorías del catálogo + las que aparezcan en los
  // tickets (una categoría desactivada o borrada igual debe poder filtrarse).
  const opcionesCategoria = useMemo(() => {
    const nombres = new Set(categorias.map((c) => c.nombre));
    for (const t of tickets) if (t.categoria) nombres.add(t.categoria);
    return [...nombres].sort((a, b) => a.localeCompare(b));
  }, [categorias, tickets]);

  return (
    <div className="space-y-2">
      {!soloPapelera && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportarTicketsCsv(filtered, asignado, sla)} disabled={filtered.length === 0}>
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

      <FiltrosTickets categorias={opcionesCategoria} activos={filtrosActivos} onAplicar={setFiltros} />

      {loading || !empleadosListos ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <ListaVacia soloPapelera={soloPapelera} conFiltros={filtrosActivos} />
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
                asignado={asignado(ticket)}
                acciones={<AccionesTicket ticket={ticket} soloPapelera={soloPapelera} esAdmin={isAdmin} />}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
