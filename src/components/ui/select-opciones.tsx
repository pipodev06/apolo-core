import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface Opcion {
  value: string
  label: string
}

// Select de una lista de opciones. Arma `items` (lo que necesita SelectValue
// para mostrar el label con el select cerrado) y los SelectItem desde la
// MISMA lista, así nunca quedan desincronizados. Usarlo en vez de componer
// Select + SelectItem a mano cuando las opciones son una lista simple.
export function SelectOpciones({
  id,
  opciones,
  value,
  onChange,
  className,
}: {
  id?: string
  opciones: Opcion[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select items={opciones} value={value} onValueChange={(v) => v != null && onChange(v)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {opciones.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
