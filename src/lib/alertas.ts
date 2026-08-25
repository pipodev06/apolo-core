import Swal from "sweetalert2";

const btnBase =
  "inline-flex cursor-pointer items-center justify-center rounded-md px-4 h-10 text-sm font-medium transition-colors mx-1";

interface ConfirmOpts {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

// Confirmación con SweetAlert2 tematizada con los tokens del sistema (sigue
// light/dark). background/color van como var(--token) en la propiedad de la
// API de Swal (termina como inline style) a propósito, NO como clase de
// Tailwind: SweetAlert2 inyecta su propio <style> en el <head> recién al
// llamar fire(), después del CSS de Tailwind -- en un empate de especificidad
// contra una clase (.swal2-popup vs .bg-x), gana el que se cargó último (el
// de SweetAlert2). Un inline style siempre gana ese empate.
export async function confirmar(opts: ConfirmOpts): Promise<boolean> {
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: opts.confirmText || "Confirmar",
    cancelButtonText: opts.cancelText || "Cancelar",
    background: "var(--background)",
    color: "var(--foreground)",
    buttonsStyling: false,
    customClass: {
      popup: "rounded-xl border border-gray-200 shadow-xl",
      confirmButton: `${btnBase} ${
        opts.danger
          ? "border border-red-600 bg-red-600 text-white hover:bg-red-600/90"
          : "border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-600/90"
      }`,
      cancelButton: `${btnBase} border border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-100/80`,
    },
  });
  return result.isConfirmed;
}

// Notificaciones con SweetAlert2 normal (modal centrado común, NO toast).
function notificar(icon: "success" | "error", title: string) {
  Swal.fire({
    icon,
    title,
    confirmButtonText: "Aceptar",
    background: "var(--background)",
    color: "var(--foreground)",
    buttonsStyling: false,
    customClass: {
      popup: "rounded-xl border border-gray-200 shadow-xl",
      confirmButton: `${btnBase} ${
        icon === "error"
          ? "border border-red-600 bg-red-600 text-white hover:bg-red-600/90"
          : "border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-600/90"
      }`,
    },
  });
}

export function notificarExito(title: string) {
  notificar("success", title);
}

export function notificarError(title: string) {
  notificar("error", title);
}

