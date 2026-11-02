import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { notificacionesService } from "../services/notificacionesService";
import type { Notificacion } from "../types/notificacion";
import type { FirestoreTimestamp } from "../types/firestore";
import { useAuth } from "../context/AuthContext";
import { TablaCard, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { FiltroBuscarPor, type BusquedaPorCampo } from "../components/ui/filtro-buscar-por";
import { SimplePagination } from "../components/ui/pagination";
import { PageSpinner } from "../components/ui/spinner";
import { EstadoVacio } from "../components/ui/estado-vacio";
import { IconBell as Bell } from "@tabler/icons-react";
import { usePaginacion } from "../lib/usePaginacion";
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

  // Búsqueda aplicada (el borrador vive en FiltroBuscarPor). campo: "" = todos,
  // o "ticket" | "detalle".
  const [busqueda, setBusqueda] = useState<BusquedaPorCampo>({ query: "", campo: "" });
  const { query, campo: fCampo } = busqueda;

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
  const { pagina, totalPages, paginados: paginadas, numero, setPage } = usePaginacion(
    filtradas,
    PAGE_SIZE,
    `${query}|${fCampo}`
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
        {noLeidas.length > 0 && (
          <Button variant="outline" onClick={handleMarcarTodas}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      <FiltroBuscarPor
        campos={[
          { value: "ticket", label: "Ticket" },
          { value: "detalle", label: "Detalle" },
        ]}
        activo={hayFiltrosActivos}
        onAplicar={setBusqueda}
      />

      {loading ? (
        <PageSpinner />
      ) : filtradas.length === 0 ? (
        <EstadoVacio
          icono={Bell}
          titulo="Sin notificaciones"
          detalle="Todavía no tienes notificaciones."
          conFiltros={notificaciones.length > 0}
          tituloFiltros="Ninguna coincide"
          textoFiltros="Ninguna notificación coincide con la búsqueda."
        />
      ) : (
        <>
          <TablaCard>
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
                <TableRow key={n.id} className={cn(!n.leida && "bg-primary/5")}>
                  <TableCell>{numero(i)}</TableCell>
                  <TableCell className="font-semibold text-primary">{n.ticketCode}</TableCell>
                  <TableCell>{n.mensaje}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtRelativo(n.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleClick(n)}>
                      Ver ticket
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TablaCard>

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
