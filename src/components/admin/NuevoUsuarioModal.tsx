import React, { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { USERNAME_REGEX, USERNAME_MENSAJE } from "../../lib/cuentas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { SelectOpciones } from "../ui/select-opciones";
import { usersService } from "../../services/usersService";
import { useCatalogos } from "../../context/CatalogosContext";
import { notificarExito, notificarError } from "../../lib/alertas";
import { PasswordInput } from "../ui/password-input";

const SIN_VINCULO = "__none__";

const schema = z.object({
  username: z.string().trim().regex(USERNAME_REGEX, USERNAME_MENSAJE),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["usuario", "admin"]),
  personalId: z.string(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const NuevoUsuarioModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { empleados: todosEmpleados } = useCatalogos();
  const empleados = useMemo(() => todosEmpleados.filter((e) => e.activo), [todosEmpleados]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "usuario", personalId: SIN_VINCULO },
  });
  const role = watch("role");

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    try {
      await usersService.create({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        role: data.role,
        personalId: data.personalId !== SIN_VINCULO ? data.personalId : undefined,
      });
      notificarExito("Usuario creado correctamente");
      reset();
      onCreated();
      onClose();
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al crear el usuario");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
        </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field data-invalid={!!errors.username}>
            <FieldLabel htmlFor="username">Usuario</FieldLabel>
            <Input id="username" placeholder="ej. jperez" aria-invalid={!!errors.username} {...register("username")} />
            <FieldError errors={[errors.username]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <PasswordInput
              id="password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="role">Rol</FieldLabel>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <SelectOpciones
                  id="role"
                  opciones={[
                    { value: "usuario", label: "Usuario" },
                    { value: "admin", label: "Administrador" },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
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
                  <SelectOpciones
                    id="personalId"
                    opciones={[
                      { value: SIN_VINCULO, label: "Sin vincular" },
                      ...empleados.map((e) => ({ value: e.id, label: e.nombre })),
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </FieldGroup>
      </form>
      </DialogContent>
    </Dialog>
  );
};
