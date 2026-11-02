import type { Role } from "./roles";

// El login es por nombre de usuario, pero Firebase Auth trabaja con email:
// cada cuenta usa un email interno `usuario@apolo.local` que nunca recibe
// correos. Mismo dominio en firestore.rules (setup) y functions/src/auth.ts.
const DOMINIO_CUENTAS = "apolo.local";

// Letras, números, punto, guion y guion bajo: lo que acepta un email sin escapar.
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,60}$/;
export const USERNAME_MENSAJE = "Entre 3 y 60 caracteres: letras, números, punto, guion o guion bajo";

export const emailDeUsuario = (username: string) => `${username.trim().toLowerCase()}@${DOMINIO_CUENTAS}`;

// Secciones con las que arranca una cuenta nueva. Un "usuario" solo ve
// Tickets y Notificaciones; el resto se habilita desde la Matriz de Accesos.
export function seccionesIniciales(role: Role) {
  const esAdmin = role === "admin" || role === "super_admin";
  return {
    dashboard: esAdmin,
    tickets: true,
    personal: esAdmin,
    administracion: esAdmin,
    notificaciones: true,
    papelera: esAdmin,
    historico: esAdmin,
    subirImagenes: esAdmin,
  };
}

// Traduce los códigos de Firebase Auth a mensajes para el usuario.
export function mensajeErrorAuth(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Usuario o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intenta de nuevo en unos minutos.";
    case "auth/email-already-in-use":
      return "El nombre de usuario ya existe.";
    case "auth/weak-password":
      return "La contraseña es muy débil.";
    case "auth/operation-not-allowed":
      return "El login con usuario y contraseña no está habilitado en Firebase. Actívalo en la consola: Authentication → Sign-in method → Correo electrónico/contraseña.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    default:
      return error instanceof Error ? error.message : "Error de autenticación.";
  }
}
