import React, { useEffect, useMemo, useState } from "react";
import { useTickets } from "../context/TicketsContext";
import { useCatalogos } from "../context/CatalogosContext";
import { useAuth } from "../context/AuthContext";
import { esAdmin } from "../lib/roles";
import { PageSpinner } from "../components/ui/spinner";
import {
  IconTicket as TicketIcon, IconAlertCircle as AlertCircle, IconLoader2 as Loader,
  IconCircleCheck as CheckCircle2, IconPercentage as Percent,
} from "@tabler/icons-react";
import { promedioResolucionMs } from "../lib/sla";
import { resumenTickets, ticketsPorArea, ticketsPorCategoria, ticketsPorEmpleado } from "../lib/metricasDashboard";
import { StatCard } from "../components/dashboard/StatCard";
import { TablaPorArea } from "../components/dashboard/TablaPorArea";
import {
  BarrasHorizontales, GraficoBarras, GraficoCard, GraficoDona, GraficoTendencia,
} from "../components/dashboard/Graficos";

export const Dashboard: React.FC = () => {
  // tickets viene de TicketsProvider (App.tsx) — un solo listener compartido
  // por sesión, en vez de que Dashboard abra el suyo propio: al volver acá
  // después de haber visitado Tickets o Personal, los datos ya están.
  const { tickets, loading: ticketsLoading, sla } = useTickets();
  const { empleados, empleadosListos } = useCatalogos();
  const { user } = useAuth();
  // Un "usuario" solo recibe sus propios tickets (reglas de Firestore): para
  // él el Dashboard es "Mi resumen", sin las tablas por área y por técnico
  // que solo tienen sentido mirando a todo el equipo.
  const vistaEquipo = esAdmin(user?.role);
  const [revelado, setRevelado] = useState(false);

  // Igual que TicketsList: mientras no está "revelado" se muestra el
  // PageSpinner de más abajo, no el contenido real. La diferencia con
  // Tickets es que acá el contenido real incluye montar 3 gráficos de
  // Recharts (SVG/layout pesado) — si se saca el spinner apenas llegan los
  // datos, ese montaje pesado ocurre en el mismo commit que el cambio de
  // ruta, y corta a mitad la transición de color del ítem activo del
  // sidebar. El doble requestAnimationFrame espera a que el navegador ya
  // haya pintado el spinner (y termine esa transición) antes de recién ahí
  // sacarlo y disparar el montaje pesado.
  useEffect(() => {
    if (ticketsLoading || !empleadosListos || revelado) return;
    let cancelado = false;
    requestAnimationFrame(() => {
      if (cancelado) return;
      requestAnimationFrame(() => {
        if (!cancelado) setRevelado(true);
      });
    });
    return () => {
      cancelado = true;
    };
  }, [ticketsLoading, empleadosListos, revelado]);

  // Memoizado: no se recalcula en renders que no cambian tickets (ej. el
  // toggle de tema).
  const resumen = useMemo(() => resumenTickets(tickets), [tickets]);
  const porEmpleado = useMemo(() => ticketsPorEmpleado(tickets, empleados), [tickets, empleados]);
  const porArea = useMemo(() => ticketsPorArea(tickets, sla), [tickets, sla]);
  const promedioGeneral = useMemo(() => promedioResolucionMs(tickets), [tickets]);
  const porCategoria = useMemo(() => ticketsPorCategoria(tickets), [tickets]);

  if (!revelado) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{vistaEquipo ? "Dashboard de Métricas" : "Mi resumen"}</h1>
        {!vistaEquipo && (
          <p className="text-base text-muted-foreground">Métricas de los tickets que creaste o que tienes asignados.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Total" value={resumen.total} icon={TicketIcon} tone="indigo" />
        <StatCard title="Pendientes" value={resumen.pendientes} icon={AlertCircle} tone="amber" />
        <StatCard title="En proceso" value={resumen.enProceso} icon={Loader} tone="purple" />
        <StatCard title="Terminados" value={resumen.terminados} icon={CheckCircle2} tone="green" />
        <StatCard title="% Resueltos" value={`${resumen.resueltoPct}%`} icon={Percent} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GraficoCard titulo="Tickets por Estado">
          <GraficoDona data={resumen.statusData} />
        </GraficoCard>
        <GraficoCard titulo="Tickets por Urgencia">
          <GraficoBarras data={resumen.urgencyData} />
        </GraficoCard>
        <GraficoCard titulo="Tickets Creados (Últimos 14 días)" ancho>
          <GraficoTendencia data={resumen.last14Days} />
        </GraficoCard>
        <GraficoCard titulo="Tickets por Categoría" ancho alto="h-72">
          <BarrasHorizontales data={porCategoria} color="#0ea5e9" anchoEtiqueta={150} />
        </GraficoCard>

        {vistaEquipo && (
          <>
            <TablaPorArea filas={porArea} promedioGeneral={promedioGeneral} />
            <GraficoCard titulo="Tickets por Personal Asignado" ancho alto="h-72">
              <BarrasHorizontales data={porEmpleado} color="#6366f1" anchoEtiqueta={120} />
            </GraficoCard>
          </>
        )}
      </div>
    </div>
  );
};
