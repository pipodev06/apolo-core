import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <IconLoader data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

// Patrón único del proyecto para estados de carga de página/lista completa
// (tabla, tab, etc): spinner grande centrado con padding. Usar este en vez de
// repetir el div centrador a mano en cada vista.
function PageSpinner({ className }: { className?: string }) {
  return (
    <div className="flex justify-center py-12">
      <Spinner className={cn("size-12 text-indigo-600", className)} />
    </div>
  )
}

export { Spinner, PageSpinner }
