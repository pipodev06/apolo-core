import type { Icon } from "@tabler/icons-react"
import { IconPencil as Pencil, IconPower as Power, IconRestore as RotateCcw, IconTrash as Trash2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const tonos = {
  primary: "hover:bg-muted hover:text-primary",
  neutral: "hover:bg-muted hover:text-foreground",
  success: "hover:bg-green-500/10 hover:text-green-600",
  destructive: "hover:bg-destructive/10 hover:text-destructive",
} as const

function AccionIcono({
  icon: Icono,
  title,
  onClick,
  tono,
  disabled,
}: {
  icon: Icon
  title: string
  onClick: () => void
  tono: keyof typeof tonos
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        tonos[tono]
      )}
    >
      <Icono className="h-5 w-5" />
    </button>
  )
}

interface AccionesFilaProps {
  soloPapelera: boolean
  onRestaurar: () => void
  onPurgar: () => void
  // Vista normal (no Papelera): activar/desactivar, editar, eliminar.
  activo?: boolean
  onToggle?: () => void
  onEditar?: () => void
  onEliminar?: () => void
  // Deshabilita eliminar / eliminar definitivo (ej. cuentas super_admin).
  bloquearBorrado?: boolean
  // Deshabilita todas las acciones (ej. un admin mirando a un super_admin o a
  // una cuenta protegida): mejor que dejar pulsar y que falle al guardar.
  bloqueadoMotivo?: string
}

// Acciones de una fila de tabla — componente único para Personal, Usuarios,
// catálogos y la Papelera (no repetir los botones a mano en cada vista).
export function AccionesFila({
  soloPapelera,
  onRestaurar,
  onPurgar,
  activo,
  onToggle,
  onEditar,
  onEliminar,
  bloquearBorrado,
  bloqueadoMotivo,
}: AccionesFilaProps) {
  const bloqueado = !!bloqueadoMotivo
  const titulo = (t: string) => (bloqueado ? bloqueadoMotivo : t)
  return (
    <div className="flex items-center gap-1">
      {soloPapelera ? (
        <>
          <AccionIcono icon={RotateCcw} title={titulo("Restaurar")} tono="success" onClick={onRestaurar} disabled={bloqueado} />
          <AccionIcono icon={Trash2} title={titulo("Eliminar definitivo")} tono="destructive" onClick={onPurgar} disabled={bloquearBorrado || bloqueado} />
        </>
      ) : (
        <>
          {onToggle && (
            <AccionIcono
              icon={Power}
              title={titulo(activo ? "Desactivar" : "Activar")}
              tono={activo ? "neutral" : "success"}
              onClick={onToggle}
              disabled={bloqueado}
            />
          )}
          {onEditar && <AccionIcono icon={Pencil} title={titulo("Editar")} tono="primary" onClick={onEditar} disabled={bloqueado} />}
          {onEliminar && (
            <AccionIcono icon={Trash2} title={titulo("Eliminar")} tono="destructive" onClick={onEliminar} disabled={bloquearBorrado || bloqueado} />
          )}
        </>
      )}
    </div>
  )
}
