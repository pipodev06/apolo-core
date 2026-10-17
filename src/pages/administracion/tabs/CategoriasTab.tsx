import React, { useRef } from "react";
import { IconPlus as Plus } from "@tabler/icons-react";
import { CatalogoCrud, type CatalogoCrudHandle } from "../../../components/personal/CatalogoCrud";
import { categoriasService } from "../../../services/catalogosService";
import { Button } from "../../../components/ui/button";

// Categorías de ticket: mismo CRUD de catálogo que cargos/áreas (CatalogoCrud).
export const CategoriasTab: React.FC = () => {
  const crudRef = useRef<CatalogoCrudHandle>(null);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button onClick={() => crudRef.current?.abrirNuevo()}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>
      <CatalogoCrud ref={crudRef} singular="categoría" femenino service={categoriasService} />
    </div>
  );
};
