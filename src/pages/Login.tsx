import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { IconEye as Eye, IconEyeOff as EyeOff, IconTicket as Ticket } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "../components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../components/ui/input-group";
import { notificarExito, notificarError } from "../lib/alertas";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Instalación fresca (config/app todavía no existe): manda directo a
  // /setup en vez de mostrar un login que nadie puede usar. Espejo de
  // SetupGuard, que hace lo inverso. Si la lectura falla (offline, etc.) se
  // asume inicializada y se muestra el login igual — la app ya está en uso
  // real, más vale eso que dejar a todos sin poder entrar por un error.
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  useEffect(() => {
    authService
      .appEstaInicializada()
      .then((inicializada) => setNeedsSetup(!inicializada))
      .catch(() => setNeedsSetup(false));
  }, []);

  const from = location.state?.from?.pathname || "/";

  if (needsSetup === null) return null;
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
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
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
