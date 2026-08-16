import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { notificacionesService } from "../services/notificacionesService";
import type { Notificacion } from "../types/notificacion";
import type { FirestoreTimestamp } from "../types/firestore";
import { useAuth } from "../context/AuthContext";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { SimplePagination } from "../components/ui/pagination";
import { PageSpinner } from "../components/ui/spinner";
import { IconBell as Bell, IconSearch as Search, IconFilterOff as FilterX } from "@tabler/icons-react";
import { cn } from "../lib/cn";

const PAGE_SIZE = 15;

function fmtRelativo(value: FirestoreTimestamp | null | undefined): string {
  if (!value) return "-";
  const d = value instanceof Timestamp ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "-";
  return formatDistanceToNow(d, { locale: es, addSuffix: true });
}

export const Notificaciones: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Borrador: lo que el usuario va eligiendo antes de aplicar.
  // dCampo: "" = todos los campos, o "ticket" | "detalle" para acotar la búsqueda a ese campo.
  const [dQuery, setDQuery] = useState("");
  const [dCampo, setDCampo] = useState("");

  // Aplicado: lo que realmente filtra la lista, se actualiza con "Buscar".
  const [query, setQuery] = useState("");
  const [fCampo, setFCampo] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsubscribe = notificacionesService.watchAll(user.userId, (data) => {
      setNotificaciones(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const noLeidas = notificaciones.filter((n) => !n.leida);

  const handleMarcarTodas = async () => {
    await notificacionesService.marcarTodasLeidas(noLeidas.map((n) => n.id));
  };

  const handleClick = async (n: Notificacion) => {
    if (!n.leida) await notificacionesService.marcarLeida(n.id);
    navigate(`/tickets/${n.ticketId}`);
  };

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notificaciones;
    return notificaciones.filter((n) => {
      if (fCampo === "ticket") return n.ticketCode.toLowerCase().includes(q);
      if (fCampo === "detalle") return n.mensaje.toLowerCase().includes(q);
      return n.ticketCode.toLowerCase().includes(q) || n.mensaje.toLowerCase().includes(q);
    });
  }, [notificaciones, query, fCampo]);

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

  // Reinicia a la página 1 cuando cambian los filtros aplicados.
  const filtrosKey = `${query}|${fCampo}`;
  const [prevFiltrosKey, setPrevFiltrosKey] = useState(filtrosKey);
  if (filtrosKey !== prevFiltrosKey) {
    setPrevFiltrosKey(filtrosKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginadas = useMemo(
    () => filtradas.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtradas, pageSafe]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Notificaciones</h1>
        {noLeidas.length > 0 && (
          <Button variant="outline" onClick={handleMarcarTodas}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <Select
            items={[
              { value: "__all__", label: "Todos los campos" },
              { value: "ticket", label: "Ticket" },
              { value: "detalle", label: "Detalle" },
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
                <SelectItem value="ticket">Ticket</SelectItem>
                <SelectItem value="detalle">Detalle</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-55 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-800 dark:text-gray-100" />
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

      {loading ? (
        <PageSpinner />
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <Bell className="mx-auto mb-4 h-12 w-12 text-gray-800/40 dark:text-gray-100/40" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            {notificaciones.length === 0 ? "Sin notificaciones" : "Ninguna coincide"}
          </h3>
          <p className="text-gray-800 dark:text-gray-100">
            {notificaciones.length === 0
              ? "Todavía no tienes notificaciones."
              : "Ninguna notificación coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((n, i) => (
                  <TableRow key={n.id} className={cn(!n.leida && "bg-indigo-600/5")}>
                    <TableCell>{(pageSafe - 1) * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell className="font-semibold text-indigo-600">{n.ticketCode}</TableCell>
                    <TableCell className="text-gray-800 dark:text-gray-100">{n.mensaje}</TableCell>
                    <TableCell className="text-gray-800 dark:text-gray-100">{fmtRelativo(n.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleClick(n)}>
                        Ver ticket
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
