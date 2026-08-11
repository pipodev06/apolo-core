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
import { Field, FieldError, FieldGroup, FieldLabel } from "../components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../components/ui/input-group";
import { UrgencyBadge } from "../components/tickets/UrgencyBadge";
import { notificarExito, notificarError } from "../lib/alertas";
import type { Urgency } from "../types/ticket";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Muestra ilustrativa: refleja el tipo de incidentes reales del sistema, no datos en vivo.
const colaEjemplo: { code: string; title: string; urgency: Urgency }[] = [
  { code: "TK01-0032", title: "Servidor no responde", urgency: "CRITICO" },
  { code: "TK01-0018", title: "VPN no conecta", urgency: "ALTO" },
  { code: "TK01-0044", title: "Actualización pendiente", urgency: "MEDIO" },
  { code: "TK01-0007", title: "Falla en impresora", urgency: "BAJO" },
  { code: "TK01-0051", title: "Error en base de datos", urgency: "ALTO" },
  { code: "TK01-0029", title: "Backup fallido", urgency: "CRITICO" },
];

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Panel de marca */}
      <div className="relative flex flex-col justify-between gap-8 overflow-hidden bg-gray-900 px-6 py-8 lg:w-[42%] lg:px-12 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Ticket className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight lg:text-2xl">
            <span className="text-gray-400">Sistema de Tickets</span>{" "}
            <span className="text-indigo-600">SIT</span>{" "}
            <span className="text-indigo-600">SambaNova AI</span>
          </h1>
        </div>

        <div className="relative z-10 hidden lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Cola de incidentes
          </p>
          <div className="queue-mask relative h-72 overflow-hidden">
            <div className="queue-track space-y-2.5">
              {[...colaEjemplo, ...colaEjemplo].map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-400">{t.code}</span>
                    <span className="truncate text-sm font-medium text-gray-50">{t.title}</span>
                  </div>
                  <UrgencyBadge urgency={t.urgency} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative z-10 hidden text-xs text-gray-400 lg:block">
          Acceso restringido al personal autorizado.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-800">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-gray-800">Ingresa tus credenciales para acceder.</p>
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
        </div>
      </div>
    </div>
  );
};
