import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { empleadosService } from "../../services/empleadosService";
import { cargosService, areasService } from "../../services/catalogosService";
import type { Empleado } from "../../types/empleado";
import type { Catalogo } from "../../types/catalogo";
import { notificarExito, notificarError } from "../../lib/alertas";

const schema = z.object({
  nombre: z.string().min(3, "Mínimo 3 caracteres"),
  cargo: z.string().optional(),
  area: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  empleado?: Empleado | null;
}

export const EmpleadoModal: React.FC<Props> = ({ open, onClose, onSaved, empleado }) => {
  const isEdit = !!empleado;
  const [cargos, setCargos] = useState<Catalogo[]>([]);
  const [areas, setAreas] = useState<Catalogo[]>([]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    cargosService.getAll().then((d) => setCargos(d.filter((c) => c.activo))).catch(() => {});
    areasService.getAll().then((d) => setAreas(d.filter((c) => c.activo))).catch(() => {});
    reset({
      nombre: empleado?.nombre || "",
      cargo: empleado?.cargo || "",
      area: empleado?.area || "",
      email: empleado?.email || "",
      telefono: empleado?.telefono || "",
    });
  }, [open, empleado, reset]);

  // Los <select> de Cargo/Área se pueblan de forma asíncrona, después del reset()
  // de arriba. Si al momento del reset la <option> todavía no existe, el navegador
  // no encuentra coincidencia y el campo queda en "Sin especificar" aunque el
  // empleado sí tenga cargo/área — al guardar se perdería el dato. Re-aplicamos
  // el valor una vez que las opciones ya están cargadas.
  useEffect(() => {
    if (!open) return;
    if (empleado?.cargo) setValue("cargo", empleado.cargo);
    if (empleado?.area) setValue("area", empleado.area);
  }, [open, empleado, cargos, areas, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && empleado) {
        await empleadosService.update(empleado.id, data);
        notificarExito("Empleado actualizado exitosamente");
      } else {
        await empleadosService.create({ ...data, activo: true });
        notificarExito("Empleado creado exitosamente");
      }
      onSaved();
      onClose();
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al guardar el empleado");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          <DialogDescription>Personal disponible para asignar tickets.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field data-invalid={!!errors.nombre}>
            <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
            <Input
              id="nombre"
              required
              autoFocus
              placeholder="ej. Juan Pérez"
              aria-invalid={!!errors.nombre}
              {...register("nombre")}
            />
            <FieldError errors={[errors.nombre]} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="cargo">Cargo</FieldLabel>
              <Controller
                name="cargo"
                control={control}
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "__none__", label: "Sin especificar" },
                      ...cargos.map((c) => ({ value: c.nombre, label: c.nombre })),
                    ]}
                    value={field.value || "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="cargo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__none__">Sin especificar</SelectItem>
                        {cargos.map((c) => (
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
            <Field>
              <FieldLabel htmlFor="area">Área</FieldLabel>
              <Controller
                name="area"
                control={control}
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "__none__", label: "Sin especificar" },
                      ...areas.map((a) => ({ value: a.nombre, label: a.nombre })),
                    ]}
                    value={field.value || "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="area" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__none__">Sin especificar</SelectItem>
                        {areas.map((a) => (
                          <SelectItem key={a.id} value={a.nombre}>
                            {a.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="opcional"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
              <Input
                id="telefono"
                type="tel"
                autoComplete="tel"
                placeholder="opcional"
                {...register("telefono")}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear empleado"}
            </Button>
          </DialogFooter>
        </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
};
