import { useState } from "react"

interface ExpandableTextProps {
  texto: string
  maxChars: number
  className?: string
}

// Trunca texto largo con un link "Ver más" / "Ver menos" — usado en
// comentarios del ticket y en la descripción del detalle.
function ExpandableText({ texto, maxChars, className }: ExpandableTextProps) {
  const [expandido, setExpandido] = useState(false)
  // Los saltos de línea no cuentan para decidir si hay que truncar, ni para
  // el largo de la vista previa — si no, un texto corto con muchos \n se
  // trunca antes de tiempo y la preview queda con saltos de línea raros.
  const textoPreview = texto.replace(/\s*\n+\s*/g, " ").trim()
  const esLargo = textoPreview.length > maxChars

  if (!esLargo) {
    return <p className={className}>{texto}</p>
  }

  return (
    <p className={className}>
      {expandido ? texto : `${textoPreview.slice(0, maxChars)}... `}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="cursor-pointer font-medium text-blue-600 hover:underline"
      >
        {expandido ? " Ver menos" : "Ver más"}
      </button>
    </p>
  )
}

export { ExpandableText }
