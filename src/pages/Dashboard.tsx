import React, { useEffect, useMemo, useState } from "react";
import { collection, query, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Ticket } from "../types/ticket";
import type { Empleado } from "../types/empleado";
import { empleadosService } from "../services/empleadosService";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { PageSpinner } from "../components/ui/spinner";
import { IconTicket as TicketIcon, IconAlertCircle as AlertCircle, IconLoader2 as Loader, IconCircleCheck as CheckCircle2, IconPercentage as Percent, type Icon as LucideIcon } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { useTheme } from "../context/ThemeContext";

export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  // Los gráficos de Recharts se pintan en SVG con props/estilos inline, no
  // clases de Tailwind: no responden a `dark:`, hay que resolver el color a mano.
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const gridColor = theme === "dark" ? "#334155" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: theme === "dark" ? "#111827" : "#ffffff",
    border: `1px solid ${gridColor}`,
    borderRadius: "0.5rem",
    color: theme === "dark" ? "#f1f5f9" : "#0f172a",
    fontSize: "0.8125rem",
  };

  useEffect(() => {
    let ticketsListos = false;
    let empleadosListos = false;
    let yaRevelado = false;

    // Igual que TicketsList: mientras loading=true se muestra el PageSpinner
    // de más abajo, no el contenido real. La diferencia con Tickets es que
    // acá el contenido real incluye montar 3 gráficos de Recharts (SVG/layout
    // pesado) — si se saca el spinner apenas llegan los datos, ese montaje
    // pesado ocurre en el mismo commit que el cambio de ruta, y corta a
    // mitad la transición de color del ítem activo del sidebar. El doble
    // requestAnimationFrame espera a que el navegador ya haya pintado el
    // spinner (y termine esa transición) antes de recién ahí sacarlo y
    // disparar el montaje pesado.
    const revelarCuandoListo = () => {
      if (!ticketsListos || !empleadosListos || yaRevelado) return;
      yaRevelado = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setLoading(false));
      });
    };

    const q = query(collection(db, "tickets"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Ticket))
        .filter((t) => !t.deletedAt);
      setTickets(data);
      ticketsListos = true;
      revelarCuandoListo();
    });
    empleadosService
      .getAll()
      .then((data) => setEmpleados(data))
      .catch(() => {})
      .finally(() => {
        empleadosListos = true;
        revelarCuandoListo();
      });
    return () => unsubscribe();
  }, []);

  // Un solo pase sobre tickets (en vez de ~10 .filter() separados, cada uno
  // recorriendo el arreglo entero) — y memoizado, para no recalcular nada de
  // esto en renders que no cambian tickets (ej. el toggle de tema).
  const { total, pendientes, enProceso, terminados, resueltoPct, statusData, urgencyData, last14Days } =
    useMemo(() => {
      const porStatus: Record<string, number> = {};
      const porUrgencia: Record<string, number> = {};
      for (const t of tickets) {
        porStatus[t.status] = (porStatus[t.status] ?? 0) + 1;
        porUrgencia[t.urgency] = (porUrgencia[t.urgency] ?? 0) + 1;
      }

      const total = tickets.length;
      const pendientes = porStatus["pendiente"] ?? 0;
      const enProceso = (porStatus["en_proceso"] ?? 0) + (porStatus["asignado"] ?? 0);
      const terminados = porStatus["terminado"] ?? 0;
      const resueltoPct = total ? Math.round((terminados / total) * 100) : 0;

      const statusData = [
        { name: "Pendiente", value: porStatus["pendiente"] ?? 0, color: "#64748b" },
        { name: "Asignado", value: porStatus["asignado"] ?? 0, color: "#3b82f6" },
        { name: "En Proceso", value: porStatus["en_proceso"] ?? 0, color: "#9333ea" },
        { name: "Terminado", value: porStatus["terminado"] ?? 0, color: "#16a34a" },
      ].filter((d) => d.value > 0);

      const urgencyData = [
        { name: "Bajo", value: porUrgencia["BAJO"] ?? 0, color: "#16a34a" },
        { name: "Medio", value: porUrgencia["MEDIO"] ?? 0, color: "#ca8a04" },
        { name: "Alto", value: porUrgencia["ALTO"] ?? 0, color: "#ea580c" },
        { name: "Crítico", value: porUrgencia["CRITICO"] ?? 0, color: "#dc2626" },
      ];

      // Un pase sobre tickets para agrupar por día (clave yyyy-MM-dd), en vez
      // de filtrar el arreglo completo una vez por cada uno de los 14 días.
      const porDia: Record<string, number> = {};
      for (const t of tickets) {
        if (!(t.createdAt instanceof Timestamp)) continue;
        const clave = format(t.createdAt.toDate(), "yyyy-MM-dd");
        porDia[clave] = (porDia[clave] ?? 0) + 1;
      }
      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = subDays(new Date(), 13 - i);
        return { name: format(date, "dd MMM", { locale: es }), tickets: porDia[format(date, "yyyy-MM-dd")] ?? 0 };
      });

      return { total, pendientes, enProceso, terminados, resueltoPct, statusData, urgencyData, last14Days };
    }, [tickets]);

  const porEmpleado = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const nombre = empleados.find((e) => e.id === t.assignedTo)?.nombre || "Sin asignar";
      map.set(nombre, (map.get(nombre) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [tickets, empleados]);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard de Métricas</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Total" value={total} icon={TicketIcon} tone="indigo" />
        <StatCard title="Pendientes" value={pendientes} icon={AlertCircle} tone="amber" />
        <StatCard title="En proceso" value={enProceso} icon={Loader} tone="purple" />
        <StatCard title="Terminados" value={terminados} icon={CheckCircle2} tone="green" />
        <StatCard title="% Resueltos" value={`${resueltoPct}%`} icon={Percent} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut estado */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                    {statusData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "0.8125rem", color: axisColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar urgencia */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets por Urgencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={urgencyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} />
                  <YAxis tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: gridColor, opacity: 0.3 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {urgencyData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Área tendencia 14 días */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tickets Creados (Últimos 14 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last14Days}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} stroke={gridColor} />
                  <YAxis tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={2.5} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Barras horizontales por empleado */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tickets por Personal Asignado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {porEmpleado.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porEmpleado} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                    <XAxis type="number" tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: axisColor, fontSize: 12 }}
                      stroke={gridColor}
                      width={120}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: gridColor, opacity: 0.3 }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

type Tone = "indigo" | "amber" | "purple" | "green" | "blue";

const tones: Record<Tone, string> = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

const StatCard: React.FC<{ title: string; value: number | string; icon: LucideIcon; tone: Tone }> = ({
  title,
  value,
  icon: Icon,
  tone,
}) => (
  <Card className="flex flex-col items-center gap-2 p-4 text-center">
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </Card>
);
