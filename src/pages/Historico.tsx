import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconSearch as Search, IconFilterOff as FilterX, IconHistory as History, IconEye as Eye } from "@tabler/icons-react";
import { empleadosService } from "../services/empleadosService";
import { useTickets } from "../context/TicketsContext";
import type { Empleado } from "../types/empleado";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SimplePagination } from "../components/ui/pagination";
import { PageSpinner } from "../components/ui/spinner";
import { notificarError } from "../lib/alertas";

const PAGE_SIZE = 10;

interface FilaHistorico {
  empleado: Empleado;
  asignados: number;
  terminados: number;
}

export const Historico: React.FC = () => {
  const navigate = useNavigate();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const { tickets, loading: ticketsLoading } = useTickets();
  const [page, setPage] = useState(1);

  // Borrador vs aplicado, mismo patrón que el resto de los filtros de Personal.
  const [dQuery, setDQuery] = useState("");
  const [dCampo, setDCampo] = useState("");
  const [query, setQuery] = useState("");
  const [fCampo, setFCampo] = useState("");

  useEffect(() => {
    empleadosService
      .getAll()
      .then(setEmpleados)
      .catch(() => notificarError("Error al cargar el personal"))
      .finally(() => setLoading(false));
  }, []);

  // Historial es por empleado (a quién se le asignó el ticket), no por quien
  // lo creó -- "createdBy" apunta a la cuenta de usuario que reportó, no
  // necesariamente al mismo empleado, así que no hay forma confiable de
  // cruzarlo. "Asignados" cuenta todo el historial (cualquier estado),
  // "Terminados" solo los que llegaron a status 'terminado'.
  const filas = useMemo<FilaHistorico[]>(() => {
    return empleados.map((empleado) => {
      const deEsteEmpleado = tickets.filter((t) => t.assignedTo === empleado.id);
      return {
        empleado,
        asignados: deEsteEmpleado.length,
        terminados: deEsteEmpleado.filter((t) => t.status === "terminado").length,
      };
    });
  }, [empleados, tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filas
      .filter((f) => {
        if (!q) return true;
        if (fCampo === "cargo") return (f.empleado.cargo ?? "").toLowerCase().includes(q);
        if (fCampo === "area") return (f.empleado.area ?? "").toLowerCase().includes(q);
        return (
          f.empleado.nombre.toLowerCase().includes(q) ||
          (f.empleado.cargo ?? "").toLowerCase().includes(q) ||
          (f.empleado.area ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.asignados - a.asignados);
  }, [filas, query, fCampo]);

  const hayFiltrosActivos = !!query;

  const aplicarFiltros = () => {
    setQuery(dQuery);
    setFCampo(dCampo);
  };

  const limpiarFiltros = () => {
    setDQuery("");
    setDCampo("");
    setQuery("");
    setFCampo("");
  };

  // Reinicia a la página 1 cuando cambian los filtros aplicados (mismo
  // patrón que EmpleadosTab: ajuste durante el render, no en un efecto).
  const filtrosKey = `${query}|${fCampo}`;
  const [prevFiltrosKey, setPrevFiltrosKey] = useState(filtrosKey);
  if (filtrosKey !== prevFiltrosKey) {
    setPrevFiltrosKey(filtrosKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginados = useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe]
  );

  const cargando = loading || ticketsLoading;

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Cantidad de tickets asignados y terminados por empleado, de toda la historia.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2 shadow-sm">
        <div>
          <Select
            items={[
              { value: "__all__", label: "Todos los campos" },
              { value: "cargo", label: "Cargo" },
              { value: "area", label: "Área" },
            ]}
            value={dCampo || "__all__"}
            onValueChange={(v) => setDCampo(v === "__all__" || v == null ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">Todos los campos</SelectItem>
                <SelectItem value="cargo">Cargo</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[220px] flex-1">
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

      {cargando ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card py-12 text-center">
          <History className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">
            {hayFiltrosActivos ? "Nadie coincide con la búsqueda." : "Sin personal registrado"}
          </h3>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Asignados</TableHead>
                  <TableHead>Terminados</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginados.map((f, i) => (
                  <TableRow key={f.empleado.id}>
                    <TableCell>{(pageSafe - 1) * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {f.empleado.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{f.empleado.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>{f.empleado.cargo || "-"}</TableCell>
                    <TableCell>{f.empleado.area || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="blue">{f.asignados}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="green">{f.terminados}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/historico/${f.empleado.id}`)}>
                        <Eye className="h-4 w-4" />
                        Ver detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end">
              <SimplePagination page={pageSafe} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
