import * as React from "react"
import { IconSearch as Search, IconFilterOff as FilterX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// campo "" = buscar en todos los campos.
export interface BusquedaPorCampo {
  query: string
  campo: string
}

const BUSQUEDA_VACIA: BusquedaPorCampo = { query: "", campo: "" }

const TODOS = "__all__"

// Filtro único de Personal, Usuarios, Cargos/Áreas e Histórico:
// [select "Buscar por" campo][texto][lupa]. Se edita un borrador y recién se
// aplica con "Buscar" (o Enter). Tickets tiene su propio filtro (FiltrosTickets).
export function FiltroBuscarPor({
  campos,
  activo,
  onAplicar,
}: {
  campos: { value: string; label: string }[]
  activo: boolean
  onAplicar: (busqueda: BusquedaPorCampo) => void
}) {
  const [borrador, setBorrador] = React.useState<BusquedaPorCampo>(BUSQUEDA_VACIA)
  const items = [{ value: TODOS, label: "Todos los campos" }, ...campos]

  const limpiar = () => {
    setBorrador(BUSQUEDA_VACIA)
    onAplicar(BUSQUEDA_VACIA)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2 shadow-sm">
      <div>
        <Select
          items={items}
          value={borrador.campo || TODOS}
          onValueChange={(v) => setBorrador((b) => ({ ...b, campo: v === TODOS || v == null ? "" : v }))}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {items.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-55 flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={borrador.query}
            onChange={(e) => setBorrador((b) => ({ ...b, query: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && onAplicar(borrador)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      </div>
      <Button onClick={() => onAplicar(borrador)}>
        <Search className="h-4 w-4" />
        Buscar
      </Button>
      {activo && (
        <Button variant="outline" onClick={limpiar} title="Limpiar filtros">
          <FilterX className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
