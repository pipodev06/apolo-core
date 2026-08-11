import React, { useEffect } from "react";
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
import { notificarExito, notificarError } from "../../lib/alertas";
import type { User } from "../../types/user";

const schema = z.object({
  username: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["usuario", "admin", "super_admin"]),
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
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      username: user?.username || "",
      email: user?.email || "",
      role: user?.role === "admin" || user?.role === "super_admin" ? user.role : "usuario",
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
      await usersService.update(user.id, { email: data.email || "", role: data.role });
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
