import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { IconTag as Tag } from "@tabler/icons-react";
import { TablaCard, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field, FieldLabel } from "../ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { SimplePagination } from "../ui/pagination";
import { PageSpinner } from "../ui/spinner";
import { EstadoVacio } from "../ui/estado-vacio";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import type { Catalogo } from "../../types/catalogo";
import type { CatalogoService } from "../../services/catalogosService";
import { AccionesFila } from "../ui/acciones-fila";
import { useCatalogos } from "../../context/CatalogosContext";
import { useListaConPapelera } from "../../lib/useListaConPapelera";

const PAGE_SIZE = 10;

export interface CatalogoCrudHandle {
  abrirNuevo: () => void;
  recargar: () => void;
}

interface Props {
  singular: string; // "cargo" | "área" | "categoría"
  // Concordancia de los textos ("Nueva área", "la primera categoría").
  femenino?: boolean;
  service: CatalogoService;
  soloPapelera?: boolean;
}

export const CatalogoCrud = forwardRef<CatalogoCrudHandle, Props>(
  ({ singular, femenino = false, service, soloPapelera = false }, ref) => {
  const nuevo = femenino ? "Nueva" : "Nuevo";
  const primero = femenino ? "la primera" : "el primer";
  const del = femenino ? "de la" : "del";
  // Activos desde el listener compartido (CatalogosContext); la papelera aparte.
  const catalogos = useCatalogos();
  const vivos = {
    cargos: { lista: catalogos.cargos, listo: catalogos.cargosListos },
    areas: { lista: catalogos.areas, listo: catalogos.areasListas },
    categorias: { lista: catalogos.categorias, listo: catalogos.categoriasListas },
  }[service.coleccion];
  const { items, loading, recargar } = useListaConPapelera(soloPapelera, vivos, service.listarPapelera);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Catalogo | null>(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const openNuevo = () => {
    setEditing(null);
    setNombre("");
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ abrirNuevo: openNuevo, recargar }));

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
      recargar();
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
      recargar();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const toggle = async (it: Catalogo) => {
    try {
      await service.toggleActivo(it.id, it.activo);
      recargar();
    } catch {
      notificarError("Error al actualizar");
    }
  };

  const restaurar = async (it: Catalogo) => {
    try {
      await service.restaurar(it.id);
      notificarExito("Restaurado");
      recargar();
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
      recargar();
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
        <EstadoVacio
          icono={Tag}
          titulo="Sin registros"
          detalle={`Crea ${primero} ${singular} para empezar.`}
          soloPapelera={soloPapelera}
          textoPapelera="No hay elementos eliminados."
        />
      ) : (
        <>
          <TablaCard>
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
                  <AccionesFila
                    soloPapelera={soloPapelera}
                    onRestaurar={() => restaurar(it)}
                    onPurgar={() => purgar(it)}
                    activo={it.activo}
                    onToggle={() => toggle(it)}
                    onEditar={() => openEditar(it)}
                    onEliminar={() => eliminar(it)}
                  />
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </TablaCard>

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
              <DialogTitle>{editing ? `Editar ${singular}` : `${nuevo} ${singular}`}</DialogTitle>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="nombre-catalogo">{titulo}</FieldLabel>
              <Input
                id="nombre-catalogo"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={`Nombre ${del} ${singular}`}
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
