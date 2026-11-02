import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconHistory as History, IconEye as Eye, IconDownload as Download } from "@tabler/icons-react";
import { useCatalogos } from "../context/CatalogosContext";
import { useTickets } from "../context/TicketsContext";
import type { Empleado } from "../types/empleado";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SimplePagination } from "../components/ui/pagination";
import { FiltroBuscarPor, type BusquedaPorCampo } from "../components/ui/filtro-buscar-por";
import { usePaginacion } from "../lib/usePaginacion";
import { PageSpinner } from "../components/ui/spinner";
import { EstadoVacio } from "../components/ui/estado-vacio";
import { fmtDuracion, promedioResolucionMs } from "../lib/sla";
import { descargarCsv } from "../lib/csv";

const PAGE_SIZE = 10;

interface FilaHistorico {
  empleado: Empleado;
  asignados: number;
  terminados: number;
  promedioMs: number | null; // tiempo promedio registro → terminado
}

export const Historico: React.FC = () => {
  const navigate = useNavigate();
  const { empleados, empleadosListos } = useCatalogos();
  const { tickets, loading: ticketsLoading } = useTickets();

  // Búsqueda aplicada (el borrador vive en FiltroBuscarPor). campo: "" = todos, o "cargo" | "area".
  const [busqueda, setBusqueda] = useState<BusquedaPorCampo>({ query: "", campo: "" });
  const { query, campo: fCampo } = busqueda;

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
        promedioMs: promedioResolucionMs(deEsteEmpleado),
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
  const { pagina, totalPages, paginados, numero, setPage } = usePaginacion(filtered, PAGE_SIZE, `${query}|${fCampo}`);

  const cargando = !empleadosListos || ticketsLoading;

  const exportar = () =>
    descargarCsv(
      `historico-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Empleado", "Cargo", "Área", "Asignados", "Terminados", "Tiempo prom. resolución"],
      filtered.map((f) => [
        f.empleado.nombre,
        f.empleado.cargo ?? "",
        f.empleado.area ?? "",
        f.asignados,
        f.terminados,
        fmtDuracion(f.promedioMs),
      ])
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
        </div>
        <Button variant="outline" onClick={exportar} disabled={cargando || filtered.length === 0}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <FiltroBuscarPor
        campos={[
          { value: "cargo", label: "Cargo" },
          { value: "area", label: "Área" },
        ]}
        activo={hayFiltrosActivos}
        onAplicar={setBusqueda}
      />

      {cargando ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <EstadoVacio
          icono={History}
          titulo="Sin personal registrado"
          conFiltros={hayFiltrosActivos}
          tituloFiltros="Nadie coincide con la búsqueda."
        />
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
                  <TableHead>Tiempo prom.</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginados.map((f, i) => (
                  <TableRow key={f.empleado.id}>
                    <TableCell>{numero(i)}</TableCell>
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
                    <TableCell>{fmtDuracion(f.promedioMs)}</TableCell>
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
              <SimplePagination page={pagina} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
