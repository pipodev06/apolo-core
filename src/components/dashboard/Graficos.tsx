import React from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { cn } from "../../lib/cn";
import { useColoresGrafico } from "../../lib/useColoresGrafico";
import type { Dato } from "../../lib/metricasDashboard";

// Card con título y área de altura fija para un gráfico.
export const GraficoCard: React.FC<{ titulo: string; ancho?: boolean; alto?: string; children: React.ReactNode }> = ({
  titulo,
  ancho,
  alto = "h-64",
  children,
}) => (
  <Card className={cn(ancho && "lg:col-span-2")}>
    <CardHeader>
      <CardTitle>{titulo}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className={alto}>{children}</div>
    </CardContent>
  </Card>
);

export const GraficoDona: React.FC<{ data: Dato[] }> = ({ data }) => {
  const { axisColor, tooltipStyle } = useColoresGrafico();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
          {data.map((e) => (
            <Cell key={e.name} fill={e.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "0.8125rem", color: axisColor }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const GraficoBarras: React.FC<{ data: Dato[] }> = ({ data }) => {
  const { axisColor, gridColor, tooltipStyle } = useColoresGrafico();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} />
        <YAxis tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: gridColor, opacity: 0.3 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((e) => (
            <Cell key={e.name} fill={e.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const GraficoTendencia: React.FC<{ data: { name: string; tickets: number }[] }> = ({ data }) => {
  const { axisColor, gridColor, tooltipStyle } = useColoresGrafico();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
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
  );
};

// Ranking en barras horizontales (por categoría, por personal asignado).
export const BarrasHorizontales: React.FC<{ data: Dato[]; color: string; anchoEtiqueta: number }> = ({
  data,
  color,
  anchoEtiqueta,
}) => {
  const { axisColor, gridColor, tooltipStyle } = useColoresGrafico();
  if (data.length === 0) return <p className="py-12 text-center text-muted-foreground">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
        <XAxis type="number" tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} stroke={gridColor} width={anchoEtiqueta} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: gridColor, opacity: 0.3 }} />
        <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
};
