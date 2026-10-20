import React, { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { IconKey as KeyRound } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { usersService } from "../../services/usersService";
import { useCatalogos } from "../../context/CatalogosContext";
import { notificarExito, notificarError } from "../../lib/alertas";
import type { User } from "../../types/user";

const SIN_VINCULO = "__none__";

const schema = z.object({
  username: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["usuario", "admin", "super_admin"]),
  personalId: z.string(),
  protegida: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onCambiarContrasena: () => void;
  user: User | null;
  puedeEditarUsername: boolean;
  // Solo un super_admin ve la opción "Super Admin" del rol y la marca de
  // cuenta protegida (las reglas rechazan esos cambios a cualquier otro).
  esSuperAdminActual: boolean;
}

export const EditarUsuarioModal: React.FC<Props> = ({
  open,
  onClose,
  onUpdated,
  onCambiarContrasena,
  user,
  puedeEditarUsername,
  esSuperAdminActual,
}) => {
  const { empleados: todosEmpleados } = useCatalogos();
  const empleados = useMemo(() => todosEmpleados.filter((e) => e.activo), [todosEmpleados]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const role = watch("role");

  useEffect(() => {
    if (!open) return;
    reset({
      username: user?.username || "",
      email: user?.email || "",
      role: user?.role === "admin" || user?.role === "super_admin" ? user.role : "usuario",
      personalId: user?.personalId || SIN_VINCULO,
      protegida: !!user?.protegida,
    });
  }, [open, user, reset]);

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    try {
      if (puedeEditarUsername && data.username !== user.username) {
        await usersService.updateUsername(user.id, data.username);
      }
      await usersService.update(user.id, {
        email: data.email || "",
        role: data.role,
        personalId: data.personalId !== SIN_VINCULO ? data.personalId : undefined,
        // Solo un super_admin manda la marca: para un admin la regla exige
        // que no cambie, y no enviarla la deja como está.
        ...(esSuperAdminActual ? { protegida: data.protegida } : {}),
      });
      notificarExito("Usuario actualizado");
      onUpdated();
      onClose();
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al actualizar el usuario");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.username}>
              <FieldLabel htmlFor="username">Usuario</FieldLabel>
              <Input
                id="username"
                required
                autoFocus
                disabled={!puedeEditarUsername}
                aria-invalid={!!errors.username}
                {...register("username")}
              />
              <FieldError errors={[errors.username]} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                // Pequeño delay para que este modal termine su animación de
                // cierre antes de abrir el de contraseña — si se abren en el
                // mismo tick, se ven los dos superpuestos un instante.
                setTimeout(onCambiarContrasena, 150);
              }}
            >
              <KeyRound className="h-4 w-4" />
              Cambiar Contraseña
            </Button>

            <Field>
              <FieldLabel htmlFor="role">Rol</FieldLabel>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    items={[
                      { value: "usuario", label: "Usuario" },
                      { value: "admin", label: "Administrador" },
                      ...(esSuperAdminActual ? [{ value: "super_admin", label: "Super Admin" }] : []),
                    ]}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="usuario">Usuario</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        {esSuperAdminActual && <SelectItem value="super_admin">Super Admin</SelectItem>}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {role === "usuario" && (
              <Field>
                <FieldLabel htmlFor="personalId">Vincular a técnico</FieldLabel>
                <Controller
                  name="personalId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={[
                        { value: SIN_VINCULO, label: "Sin vincular" },
                        ...empleados.map((e) => ({ value: e.id, label: e.nombre })),
                      ]}
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                    >
                      <SelectTrigger id="personalId" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={SIN_VINCULO}>Sin vincular</SelectItem>
                          {empleados.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nombre}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            {esSuperAdminActual && (
              <Field>
                <Controller
                  name="protegida"
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(!!v)}
                        className="mt-0.5"
                      />
                      <span>
                        Cuenta protegida
                        <span className="block text-xs text-muted-foreground">
                          Solo un super admin podrá editarla, cambiar su contraseña, desactivarla o eliminarla. Útil para cuentas de demo.
                        </span>
                      </span>
                    </label>
                  )}
                />
              </Field>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
};
