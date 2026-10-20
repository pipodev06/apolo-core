import React, { useRef, useState } from "react";
import { IconPlus as Plus, IconSparkles as Sparkles } from "@tabler/icons-react";
import { CatalogoCrud, type CatalogoCrudHandle } from "../../../components/personal/CatalogoCrud";
import { cargarCategoriasBase, categoriasService } from "../../../services/catalogosService";
import { Button } from "../../../components/ui/button";
import { notificarError, notificarExito } from "../../../lib/alertas";

// Categorías de ticket: mismo CRUD de catálogo que cargos/áreas (CatalogoCrud).
export const CategoriasTab: React.FC = () => {
  const crudRef = useRef<CatalogoCrudHandle>(null);
  const [cargando, setCargando] = useState(false);

  // Agrega la lista sugerida (Hardware, Software, Red e Internet, ...) sin
  // duplicar las que ya existen. Las instalaciones nuevas ya la traen desde
  // el setup inicial.
  const cargarSugeridas = async () => {
    setCargando(true);
    try {
      const creadas = await cargarCategoriasBase();
      notificarExito(creadas > 0 ? `Se agregaron ${creadas} categorías` : "Ya tienes todas las categorías sugeridas");
      crudRef.current?.recargar();
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al cargar las categorías");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={cargarSugeridas} disabled={cargando}>
          <Sparkles className="h-4 w-4" />
          {cargando ? "Cargando..." : "Cargar categorías sugeridas"}
        </Button>
        <Button onClick={() => crudRef.current?.abrirNuevo()}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>
      <CatalogoCrud ref={crudRef} singular="categoría" femenino service={categoriasService} />
    </div>
  );
};
