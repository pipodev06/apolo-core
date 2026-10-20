import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <IconLoader data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

// Patrón único del proyecto para estados de carga de una página o lista
// dentro del layout: spinner grande centrado en el área de contenido. Usar
// este en vez de repetir el div centrador a mano en cada vista.
function PageSpinner({ className }: { className?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className={cn("size-12 text-primary", className)} />
    </div>
  )
}

// Carga a pantalla completa (fuera del layout: primera carga de la app,
// verificación de permisos): cubre toda la ventana con el fondo del tema.
function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Spinner className="size-12 text-primary" />
    </div>
  )
}

export { Spinner, PageSpinner, FullScreenSpinner }
