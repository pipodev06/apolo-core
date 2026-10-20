import React, { useMemo } from "react";
import { Controller, type Control } from "react-hook-form";
import { Field, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
          <Select
            items={[
              { value: "__none__", label: "Sin categoría" },
              ...categorias.map((c) => ({ value: c.nombre, label: c.nombre })),
            ]}
            value={field.value || "__none__"}
            onValueChange={(v) => field.onChange(v === "__none__" || v == null ? "" : v)}
          >
            <SelectTrigger id="categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.nombre}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
};
