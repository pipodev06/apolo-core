import * as React from "react"

// Estado "lista vacía" único de las vistas de listado. Elige el texto según
// el caso: papelera vacía, filtros sin resultados o lista sin datos todavía.
export function EstadoVacio({
  icono: Icono,
  titulo,
  detalle,
  soloPapelera = false,
  textoPapelera,
  conFiltros = false,
  tituloFiltros,
  textoFiltros,
}: {
  icono?: React.ComponentType<{ className?: string }>
  titulo: string
  detalle?: string
  soloPapelera?: boolean
  textoPapelera?: string
  conFiltros?: boolean
  tituloFiltros?: string
  textoFiltros?: string
}) {
  let encabezado = titulo
  let texto = detalle
  if (soloPapelera) {
    encabezado = "Papelera vacía"
    texto = textoPapelera
  } else if (conFiltros) {
    encabezado = tituloFiltros ?? titulo
    texto = textoFiltros ?? detalle
  }

  return (
    <div className="rounded-lg border border-dashed bg-card py-12 text-center">
      {Icono && <Icono className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />}
      <h3 className="text-lg font-medium">{encabezado}</h3>
      {texto && <p className="text-muted-foreground">{texto}</p>}
    </div>
  )
}
