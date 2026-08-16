import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { IconPencil as Pencil, IconTrash as Trash2, IconPower as Power, IconRestore as RotateCcw, IconTag as Tag } from "@tabler/icons-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field, FieldLabel } from "../ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { SimplePagination } from "../ui/pagination";
import { PageSpinner } from "../ui/spinner";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import type { Catalogo } from "../../types/catalogo";
import type { CatalogoService } from "../../services/catalogosService";
import { cn } from "../../lib/cn";

const PAGE_SIZE = 10;

export interface CatalogoCrudHandle {
  abrirNuevo: () => void;
}

interface Props {
  singular: string; // "cargo" | "área"
  service: CatalogoService;
  soloPapelera?: boolean;
}

export const CatalogoCrud = forwardRef<CatalogoCrudHandle, Props>(
  ({ singular, service, soloPapelera = false }, ref) => {
  const [items, setItems] = useState<Catalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Catalogo | null>(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = soloPapelera ? await service.listarPapelera() : await service.getAll();
      setItems(data);
    } catch {
      notificarError("Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [soloPapelera, service]);

  useEffect(() => {
    Promise.resolve().then(fetch);
  }, [fetch]);

  const openNuevo = () => {
    setEditing(null);
    setNombre("");
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ abrirNuevo: openNuevo }));

  const openEditar = (it: Catalogo) => {
    setEditing(it);
    setNombre(it.nombre);
    setModalOpen(true);
  };

  const guardar = async () => {
    if (nombre.trim().length < 2) {
      notificarError("El nombre es muy corto");
      return;
    }
    setSaving(true);
    try {
      if (editing) await service.update(editing.id, nombre.trim());
      else await service.create(nombre.trim());
      notificarExito("Guardado correctamente");
      setModalOpen(false);
      fetch();
    } catch {
      notificarError("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (it: Catalogo) => {
    const ok = await confirmar({
      title: `Eliminar ${singular}`,
      text: `¿Seguro que deseas eliminar "${it.nombre}"? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await service.delete(it.id);
      notificarExito("Enviado a la papelera");
      fetch();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const toggle = async (it: Catalogo) => {
    try {
      await service.toggleActivo(it.id, it.activo);
      fetch();
    } catch {
      notificarError("Error al actualizar");
    }
  };

  const restaurar = async (it: Catalogo) => {
    try {
      await service.restaurar(it.id);
      notificarExito("Restaurado");
      fetch();
    } catch {
      notificarError("Error al restaurar");
    }
  };

  const purgar = async (it: Catalogo) => {
    const ok = await confirmar({
      title: "Eliminar definitivamente",
      text: `"${it.nombre}" se borrará para siempre. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar definitivo",
      danger: true,
    });
    if (!ok) return;
    try {
      await service.eliminarDefinitivo(it.id);
      notificarExito("Eliminado definitivamente");
      fetch();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const titulo = singular.charAt(0).toUpperCase() + singular.slice(1);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginados = useMemo(
    () => items.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [items, pageSafe]
  );

  return (
    <div className="space-y-2">
      {loading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <Tag className="mx-auto mb-4 h-12 w-12 text-gray-800/40 dark:text-gray-100/40" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            {soloPapelera ? "Papelera vacía" : "Sin registros"}
          </h3>
          <p className="text-gray-800 dark:text-gray-100">
            {soloPapelera ? "No hay elementos eliminados." : `Crea el primer ${singular} para empezar.`}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {paginados.map((it, i) => (
              <TableRow key={it.id}>
                <TableCell>{(pageSafe - 1) * PAGE_SIZE + i + 1}</TableCell>
                <TableCell className="font-medium">{it.nombre}</TableCell>
                <TableCell>
                  {soloPapelera ? (
                    <Badge variant="red" dot>
                      Eliminado
                    </Badge>
                  ) : (
                    <Badge variant={it.activo ? "green" : "gray"} dot>
                      {it.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {soloPapelera ? (
                      <>
                        <button
                          onClick={() => restaurar(it)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:text-gray-100"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => purgar(it)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600 dark:text-gray-100"
                          title="Eliminar definitivo"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggle(it)}
                          className={cn(
                            "cursor-pointer rounded-md p-1.5 transition-colors",
                            it.activo
                              ? "text-gray-800 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                              : "text-gray-800 hover:bg-green-500/10 hover:text-green-600 dark:text-gray-100"
                          )}
                          title={it.activo ? "Desactivar" : "Activar"}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openEditar(it)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-100 dark:hover:bg-gray-800"
                          title="Editar"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => eliminar(it)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600 dark:text-gray-100"
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
        <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? `Editar ${singular}` : `Nuevo ${singular}`}</DialogTitle>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="nombre-catalogo">{titulo}</FieldLabel>
              <Input
                id="nombre-catalogo"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={`Nombre del ${singular}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardar();
                }}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
  }
);

CatalogoCrud.displayName = "CatalogoCrud";
