import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { IconEye as Eye, IconEyeOff as EyeOff } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../ui/input-group";
import { Input } from "../ui/input";
import { authService } from "../../services/authService";
import { notificarExito, notificarError } from "../../lib/alertas";

const schema = z
  .object({
    // Solo se exige en modo "propio" (ver refine de abajo).
    passwordActual: z.string().optional(),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  user: { id: string; username: string } | null;
  // true: el usuario cambia su propia contraseña (pide la actual). false:
  // reset por admin (cierra las sesiones abiertas de esa cuenta).
  propio?: boolean;
}

export const EditarPasswordModal: React.FC<Props> = ({ open, onClose, user, propio = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    if (propio && !data.passwordActual) {
      setError("passwordActual", { message: "Ingresa tu contraseña actual" });
      return;
    }
    try {
      await authService.cambiarPassword(
        propio
          ? { passwordNueva: data.password, passwordActual: data.passwordActual }
          : { passwordNueva: data.password, userId: user.id }
      );
      notificarExito(propio ? "Contraseña actualizada" : `Contraseña de ${user.username} actualizada`);
      reset();
      onClose();
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al actualizar la contraseña");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          {propio && (
            <Field data-invalid={!!errors.passwordActual}>
              <FieldLabel htmlFor="passwordActual">Contraseña actual</FieldLabel>
              <Input
                id="passwordActual"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.passwordActual}
                {...register("passwordActual")}
              />
              <FieldError errors={[errors.passwordActual]} />
            </Field>
          )}
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirmar contraseña</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </DialogFooter>
        </FieldGroup>
      </form>
      </DialogContent>
    </Dialog>
  );
};
