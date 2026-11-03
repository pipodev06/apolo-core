import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { IconUsers as Users, IconMail as Mail, IconPhone as Phone } from "@tabler/icons-react";
import { empleadosService } from "../../services/empleadosService";
import { useTickets } from "../../context/TicketsContext";
import { useCatalogos } from "../../context/CatalogosContext";
import { useListaConPapelera } from "../../lib/useListaConPapelera";
import { esTecnico, type Empleado } from "../../types/empleado";
import { calcularCarga, estaOcupado } from "../../lib/carga";
import { TablaCard, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import { SimplePagination } from "../ui/pagination";
import { FiltroBuscarPor, type BusquedaPorCampo } from "../ui/filtro-buscar-por";
import { usePaginacion } from "../../lib/usePaginacion";
import { PageSpinner } from "../ui/spinner";
import { EstadoVacio } from "../ui/estado-vacio";
import { EmpleadoModal } from "./EmpleadoModal";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { AccionesFila } from "../ui/acciones-fila";

const PAGE_SIZE = 10;

export interface EmpleadosTabHandle {
  abrirNuevo: () => void;
}

interface Props {
  soloPapelera?: boolean;
}

export const EmpleadosTab = forwardRef<EmpleadosTabHandle, Props>(({ soloPapelera = false }, ref) => {
  // Tickets viene de TicketsProvider (App.tsx) — no aplica en la papelera,
  // ahí no se puede asignar nada, así que ni se usa.
  const { tickets, maxTicketsAbiertos } = useTickets();
  // Activos desde el listener compartido; la papelera se pide aparte.
  const catalogos = useCatalogos();
  const {
    items: empleados,
    loading,
    recargar,
  } = useListaConPapelera(
    soloPapelera,
    { lista: catalogos.empleados, listo: catalogos.empleadosListos },
    empleadosService.listarPapelera
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empleado | null>(null);

  // Búsqueda aplicada (el borrador vive en FiltroBuscarPor). campo: "" = todos, o "cargo" | "area" | "estado".
  const [busqueda, setBusqueda] = useState<BusquedaPorCampo>({ query: "", campo: "" });
  const { query, campo: fCampo } = busqueda;

  const openNuevo = () => {
    setEditing(null);
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ abrirNuevo: openNuevo }));

  const openEditar = (e: Empleado) => {
    setEditing(e);
    setModalOpen(true);
  };

  const handleToggle = async (e: Empleado) => {
    // Solo advertir al desactivar (e.activo === true, va a pasar a false) —
    // reactivar no tiene efecto sobre tickets. Desactivar no reasigna ni
    // desasigna nada, los tickets se quedan apuntando a este empleado.
    if (e.activo) {
      const carga = calcularCarga(tickets, e.id);
      if (carga > 0) {
        const ok = await confirmar({
          title: "Empleado con tickets abiertos",
          text: `${e.nombre} tiene ${carga} ${carga === 1 ? "ticket abierto" : "tickets abiertos"} asignados. Al desactivarlo van a seguir asignados a él/ella — nadie los reasigna automáticamente. ¿Desactivar igual?`,
          confirmText: "Desactivar igual",
          danger: true,
        });
        if (!ok) return;
      }
    }
    try {
      await empleadosService.toggleActivo(e.id, e.activo);
      recargar();
    } catch {
      notificarError("Error al actualizar");
    }
  };

  const handleDelete = async (e: Empleado) => {
    const carga = calcularCarga(tickets, e.id);
    const ok = await confirmar({
      title: "Eliminar empleado",
      text:
        carga > 0
          ? `${e.nombre} tiene ${carga} ${carga === 1 ? "ticket abierto" : "tickets abiertos"} asignados — van a quedar asignados a un empleado eliminado, nadie los reasigna automáticamente. ¿Enviar a la papelera igual?`
          : `¿Seguro que deseas eliminar a ${e.nombre}? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await empleadosService.delete(e.id);
      notificarExito("Enviado a la papelera");
      recargar();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const restaurar = async (e: Empleado) => {
    try {
      await empleadosService.restaurar(e.id);
      notificarExito("Empleado restaurado");
      recargar();
    } catch {
      notificarError("Error al restaurar");
    }
  };

  const purgar = async (e: Empleado) => {
    const ok = await confirmar({
      title: "Eliminar definitivamente",
      text: `${e.nombre} se borrará para siempre. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar definitivo",
      danger: true,
    });
    if (!ok) return;
    try {
      await empleadosService.eliminarDefinitivo(e.id);
      notificarExito("Eliminado definitivamente");
      recargar();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return empleados.filter((e) => {
      if (!q) return true;
      if (fCampo === "cargo") return (e.cargo ?? "").toLowerCase().includes(q);
      if (fCampo === "area") return (e.area ?? "").toLowerCase().includes(q);
      if (fCampo === "estado") return (e.activo ? "activo" : "inactivo").includes(q);
      return (
        e.nombre.toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        (e.telefono ?? "").toLowerCase().includes(q) ||
        (e.cargo ?? "").toLowerCase().includes(q) ||
        (e.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [empleados, query, fCampo]);

  const hayFiltrosActivos = !!query;
  const { pagina, totalPages, paginados, numero, setPage } = usePaginacion(filtered, PAGE_SIZE, `${query}|${fCampo}`);

  return (
    <div className="space-y-2">
      <FiltroBuscarPor
        campos={[
          { value: "cargo", label: "Cargo" },
          { value: "area", label: "Área" },
          ...(!soloPapelera ? [{ value: "estado", label: "Estado" }] : []),
        ]}
        activo={hayFiltrosActivos}
        onAplicar={setBusqueda}
      />

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Sin personal registrado"
          detalle="Crea el primer empleado para poder asignar tickets."
          soloPapelera={soloPapelera}
          textoPapelera="No hay empleados eliminados."
          conFiltros={hayFiltrosActivos}
          textoFiltros="Ningún empleado coincide con la búsqueda."
        />
      ) : (
        <>
          <TablaCard>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                {!soloPapelera && <TableHead>Carga</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {paginados.map((e, i) => (
              <TableRow key={e.id}>
                <TableCell>{numero(i)}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {e.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium">{e.nombre}</span>
                  </div>
                </TableCell>
                <TableCell>{e.cargo || "-"}</TableCell>
                <TableCell>{e.area || "-"}</TableCell>
                <TableCell>
                  {e.email ? (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {e.email}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {e.telefono ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {e.telefono}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                {!soloPapelera && (
                  <TableCell>
                    {!esTecnico(e) ? (
                      <Badge variant="gray">No técnico</Badge>
                    ) : (() => {
                      const carga = calcularCarga(tickets, e.id);
                      const ocupado = estaOcupado(carga, maxTicketsAbiertos);
                      return (
                        <Badge variant={ocupado ? "orange" : "gray"} dot>
                          {carga} {carga === 1 ? "abierto" : "abiertos"}{ocupado ? " · Ocupado" : ""}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                )}
                <TableCell>
                  {soloPapelera ? (
                    <Badge variant="red" dot>
                      Eliminado
                    </Badge>
                  ) : (
                    <Badge variant={e.activo ? "green" : "gray"} dot>
                      {e.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <AccionesFila
                    soloPapelera={soloPapelera}
                    onRestaurar={() => restaurar(e)}
                    onPurgar={() => purgar(e)}
                    activo={e.activo}
                    onToggle={() => handleToggle(e)}
                    onEditar={() => openEditar(e)}
                    onEliminar={() => handleDelete(e)}
                  />
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

      {!soloPapelera && (
        <EmpleadoModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={recargar} empleado={editing} />
      )}
    </div>
  );
});

EmpleadosTab.displayName = "EmpleadosTab";
