import React, { useState } from "react";
import { IconSearch as Search, IconFilterOff as FilterX } from "@tabler/icons-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SelectOpciones } from "../ui/select-opciones";
import { STATUS_LABELS, URGENCY_LABELS } from "../../lib/ticketStatus";
import { FILTROS_VACIOS, SIN_CATEGORIA, type FiltrosTicket } from "../../lib/filtrosTickets";
import type { TicketStatus, Urgency } from "../../types/ticket";

const TODOS = "__all__";

// Select de filtro con opción "Todos/Todas" (valor "" hacia afuera).
function FiltroSelect({
  etiqueta,
  todos,
  opciones,
  valor,
  onChange,
  ancho = "sm:w-40",
}: {
  etiqueta: string;
  todos: string;
  opciones: { value: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
  ancho?: string;
}) {
  const items = [{ value: TODOS, label: todos }, ...opciones];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{etiqueta}:</span>
      <SelectOpciones
        opciones={items}
        value={valor || TODOS}
        onChange={(v) => onChange(v === TODOS ? "" : v)}
        className={ancho}
      />
    </div>
  );
}

const opcionesDe = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

// Barra de filtros de Tickets: se edita un borrador y recién se aplica con
// "Buscar" (o Enter en el texto). Estado/Urgencia son selects dedicados
// (decisión del usuario, no unificar al patrón "Buscar por").
export const FiltrosTickets: React.FC<{
  categorias: string[];
  activos: boolean;
  onAplicar: (filtros: FiltrosTicket) => void;
}> = ({ categorias, activos, onAplicar }) => {
  const [borrador, setBorrador] = useState<FiltrosTicket>(FILTROS_VACIOS);
  const cambiar = <K extends keyof FiltrosTicket>(campo: K, valor: FiltrosTicket[K]) =>
    setBorrador((b) => ({ ...b, [campo]: valor }));

  const limpiar = () => {
    setBorrador(FILTROS_VACIOS);
    onAplicar(FILTROS_VACIOS);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2 shadow-sm">
      <FiltroSelect
        etiqueta="Estado"
        todos="Todos"
        opciones={opcionesDe(STATUS_LABELS)}
        valor={borrador.estado}
        onChange={(v) => cambiar("estado", v as TicketStatus | "")}
      />
      <FiltroSelect
        etiqueta="Urgencia"
        todos="Todas"
        opciones={opcionesDe(URGENCY_LABELS)}
        valor={borrador.urgencia}
        onChange={(v) => cambiar("urgencia", v as Urgency | "")}
      />
      <FiltroSelect
        etiqueta="Categoría"
        todos="Todas"
        opciones={[{ value: SIN_CATEGORIA, label: "Sin categoría" }, ...categorias.map((c) => ({ value: c, label: c }))]}
        valor={borrador.categoria}
        onChange={(v) => cambiar("categoria", v)}
        ancho="sm:w-44"
      />
      <div className="min-w-55 flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={borrador.query}
            onChange={(e) => cambiar("query", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAplicar(borrador)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Desde:</span>
        <Input type="date" value={borrador.desde} onChange={(e) => cambiar("desde", e.target.value)} className="sm:w-40" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Hasta:</span>
        <Input type="date" value={borrador.hasta} onChange={(e) => cambiar("hasta", e.target.value)} className="sm:w-40" />
      </div>
      <Button onClick={() => onAplicar(borrador)}>
        <Search className="h-4 w-4" />
        Buscar
      </Button>
      {activos && (
        <Button variant="outline" onClick={limpiar} title="Limpiar filtros">
          <FilterX className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
};
