import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { IconPencil as Pencil, IconTrash as Trash2, IconPower as Power, IconUsers as Users, IconMail as Mail, IconPhone as Phone, IconRestore as RotateCcw, IconSearch as Search, IconFilterOff as FilterX } from "@tabler/icons-react";
import { empleadosService } from "../../services/empleadosService";
import { ticketsService } from "../../services/ticketsService";
import { configService } from "../../services/configService";
import type { Empleado } from "../../types/empleado";
import type { Ticket } from "../../types/ticket";
import { calcularCarga, estaOcupado } from "../../lib/carga";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SimplePagination } from "../ui/pagination";
import { PageSpinner } from "../ui/spinner";
import { EmpleadoModal } from "./EmpleadoModal";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 10;

export interface EmpleadosTabHandle {
  abrirNuevo: () => void;
}

interface Props {
  soloPapelera?: boolean;
}

export const EmpleadosTab = forwardRef<EmpleadosTabHandle, Props>(({ soloPapelera = false }, ref) => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [maxTicketsAbiertos, setMaxTicketsAbiertos] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [page, setPage] = useState(1);

  // Borrador: lo que el usuario va eligiendo antes de aplicar.
  // dCampo: "" = todos los campos, o "cargo" | "area" | "estado" para acotar la búsqueda a ese campo.
  const [dQuery, setDQuery] = useState("");
  const [dCampo, setDCampo] = useState("");

  // Aplicado: lo que realmente filtra la lista, se actualiza con "Filtrar".
  const [query, setQuery] = useState("");
  const [fCampo, setFCampo] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = soloPapelera ? await empleadosService.listarPapelera() : await empleadosService.getAll();
      setEmpleados(data);
    } catch {
      notificarError("Error al cargar el personal");
    } finally {
      setLoading(false);
    }
  }, [soloPapelera]);

  useEffect(() => {
    Promise.resolve().then(fetch);
  }, [fetch]);

  // Carga (tickets abiertos por empleado): no aplica en la papelera, ahí no
  // se puede asignar nada.
  useEffect(() => {
    if (soloPapelera) return;
    ticketsService.getAll().then(setTickets).catch(() => {});
    configService.getAppConfig().then((c) => setMaxTicketsAbiertos(c.maxTicketsAbiertos)).catch(() => {});
  }, [soloPapelera]);

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
    try {
      await empleadosService.toggleActivo(e.id, e.activo);
      fetch();
    } catch {
      notificarError("Error al actualizar");
    }
  };

  const handleDelete = async (e: Empleado) => {
    const ok = await confirmar({
      title: "Eliminar empleado",
      text: `¿Seguro que deseas eliminar a ${e.nombre}? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await empleadosService.delete(e.id);
      notificarExito("Enviado a la papelera");
      fetch();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const restaurar = async (e: Empleado) => {
    try {
      await empleadosService.restaurar(e.id);
      notificarExito("Empleado restaurado");
      fetch();
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
      fetch();
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

  // Reinicia a la página 1 cuando cambian los filtros aplicados. Se ajusta
  // durante el render (patrón de React para "resetear estado cuando cambia
  // una dependencia"), no en un efecto: evita un render extra innecesario.
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

  return (
    <div className="space-y-2">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2 shadow-sm">
        <div>
          <Select
            items={[
              { value: "__all__", label: "Todos los campos" },
              { value: "cargo", label: "Cargo" },
              { value: "area", label: "Área" },
              ...(!soloPapelera ? [{ value: "estado", label: "Estado" }] : []),
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
                {!soloPapelera && <SelectItem value="estado">Estado</SelectItem>}
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

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card py-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">
            {soloPapelera ? "Papelera vacía" : "Sin personal registrado"}
          </h3>
          <p className="text-muted-foreground">
            {soloPapelera
              ? "No hay empleados eliminados."
              : hayFiltrosActivos
              ? "Ningún empleado coincide con la búsqueda."
              : "Crea el primer empleado para poder asignar tickets."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <Table>
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
                <TableCell>{(pageSafe - 1) * PAGE_SIZE + i + 1}</TableCell>
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
                    {(() => {
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
                  <div className="flex items-center gap-1">
                    {soloPapelera ? (
                      <>
                        <button
                          onClick={() => restaurar(e)}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-green-500/10 hover:text-green-600"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => purgar(e)}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Eliminar definitivo"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggle(e)}
                          className={cn(
                            "cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors",
                            e.activo ? "hover:bg-muted hover:text-foreground" : "hover:bg-green-500/10 hover:text-green-600"
                          )}
                          title={e.activo ? "Desactivar" : "Activar"}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openEditar(e)}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                          title="Editar"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
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

      {!soloPapelera && (
        <EmpleadoModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetch} empleado={editing} />
      )}
    </div>
  );
});

EmpleadosTab.displayName = "EmpleadosTab";
