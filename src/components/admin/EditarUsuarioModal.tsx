import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { IconKey as KeyRound } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { usersService } from "../../services/usersService";
import { empleadosService } from "../../services/empleadosService";
import { notificarExito, notificarError } from "../../lib/alertas";
import type { User } from "../../types/user";
import type { Empleado } from "../../types/empleado";

const SIN_VINCULO = "__none__";

const schema = z.object({
  username: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["usuario", "admin", "super_admin"]),
  personalId: z.string(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onCambiarContrasena: () => void;
  user: User | null;
  puedeEditarUsername: boolean;
}

export const EditarUsuarioModal: React.FC<Props> = ({
  open,
  onClose,
  onUpdated,
  onCambiarContrasena,
  user,
  puedeEditarUsername,
}) => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
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
    empleadosService.getAll().then((lista) => setEmpleados(lista.filter((e) => e.activo)));
    reset({
      username: user?.username || "",
      email: user?.email || "",
      role: user?.role === "admin" || user?.role === "super_admin" ? user.role : "usuario",
      personalId: user?.personalId || SIN_VINCULO,
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
                      { value: "super_admin", label: "Super Admin" },
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
                        <SelectItem value="super_admin">Super Admin</SelectItem>
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
