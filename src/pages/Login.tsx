import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { IconTicket as Ticket } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "../components/ui/field";
import { notificarExito, notificarError } from "../lib/alertas";
import { PasswordInput } from "../components/ui/password-input";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Instalación fresca (todavía sin setup): manda a /setup en vez de dejar
  // un login que nadie puede usar. Espejo de SetupGuard, que hace lo
  // inverso. La revisión corre en segundo plano: el formulario se muestra
  // de inmediato (antes la pantalla quedaba en blanco hasta que respondía).
  // Si la lectura falla (offline, etc.) se asume inicializada.
  const [needsSetup, setNeedsSetup] = useState(false);
  useEffect(() => {
    let activo = true;
    authService
      .appEstaInicializada()
      .then((inicializada) => activo && setNeedsSetup(!inicializada))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const from = location.state?.from?.pathname || "/";

  if (needsSetup) return <Navigate to="/setup" replace />;

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await login(data.username, data.password);
      notificarExito("Bienvenido de nuevo");
      navigate(from, { replace: true });
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Ticket className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">Apolo Core</span>
      </div>

      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <p className="absolute inset-x-0 bottom-6 text-center text-xs text-muted-foreground">
        Acceso restringido al personal autorizado.
      </p>

      <Card className="w-full max-w-md shadow-lg [--card-spacing:--spacing(8)]">
        <CardContent className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Ingresa tus credenciales para acceder.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.username}>
                <FieldLabel htmlFor="username">Usuario</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  required
                  aria-invalid={!!errors.username}
                  {...register("username")}
                />
                <FieldError errors={[errors.username]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Iniciar Sesión"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
