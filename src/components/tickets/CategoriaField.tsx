import React, { useMemo } from "react";
import { Controller, type Control } from "react-hook-form";
import { Field, FieldLabel } from "../ui/field";
import { SelectOpciones } from "../ui/select-opciones";
import { useCatalogos } from "../../context/CatalogosContext";
import type { TicketFormData } from "./TicketForm";

interface Props {
  control: Control<TicketFormData>;
  // Categoría guardada del ticket: se muestra aunque esté desactivada.
  categoriaActual?: string;
}

// Categoría del ticket (opcional, catálogo administrado en Administración).
export const CategoriaField: React.FC<Props> = ({ control, categoriaActual }) => {
  const { categorias: todas } = useCatalogos();
  const categorias = useMemo(
    () => todas.filter((c) => c.activo || c.nombre === categoriaActual),
    [todas, categoriaActual]
  );

  return (
    <Field>
      <FieldLabel htmlFor="categoria">Categoría</FieldLabel>
      <Controller
        name="categoria"
        control={control}
        render={({ field }) => (
          <SelectOpciones
            id="categoria"
            opciones={[
              { value: "__none__", label: "Sin categoría" },
              ...categorias.map((c) => ({ value: c.nombre, label: c.nombre })),
            ]}
            value={field.value || "__none__"}
            onChange={(v) => field.onChange(v === "__none__" ? "" : v)}
          />
        )}
      />
    </Field>
  );
};
