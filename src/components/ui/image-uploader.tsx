import * as React from "react"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { IconUpload as Upload, IconPhoto as Photo, IconX as X } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { storage } from "@/firebase"
import { compressToWebp } from "@/lib/image"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ThumbnailsProps {
  value: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
  className?: string
}

// Grilla de miniaturas + preview en modal, separada del trigger de carga para
// poder ubicarla en un lugar distinto en el layout (ej. ComentariosPanel: las
// miniaturas van arriba del input, pero el botón de agregar va al costado).
export function ImageThumbnails({ value, onChange, disabled, className }: ThumbnailsProps) {
  const [preview, setPreview] = React.useState<string | null>(null)

  if (value.length === 0) return null

  // Best-effort: borra el archivo real de Storage al quitarlo (no solo del
  // array) para no dejar basura acumulándose — si falla (ya borrado, offline),
  // no bloquea la quitada de la UI, que es lo que le importa al usuario.
  const quitar = (url: string) => {
    onChange(value.filter((u) => u !== url))
    deleteObject(ref(storage, url)).catch(() => {})
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {value.map((url) => (
          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-md border">
            <button
              type="button"
              className="h-full w-full cursor-pointer"
              onClick={() => setPreview(url)}
              aria-label="Previsualizar imagen"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={() => quitar(url)}
                aria-label="Quitar imagen"
                className="absolute top-0.5 right-0.5 cursor-pointer rounded-full bg-background/80 p-0.5 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          {preview && <img src={preview} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  pathPrefix: string
  maxFiles?: number
  disabled?: boolean
  className?: string
  // "button": pill con texto "Agregar imágenes" (TicketForm, CierreTicketPanel).
  // "icon": solo el ícono, para meter inline en una fila compacta (ComentariosPanel).
  variant?: "button" | "icon"
  // Si el caller ya renderiza las miniaturas por su cuenta (con ImageThumbnails)
  // en otra parte del layout, evita que este componente las duplique.
  hideThumbnails?: boolean
}

// Componente único de carga de imágenes — se reusa en imágenes de problema
// (TicketForm), de solución (CierreTicketPanel) y de comentarios
// (ComentariosPanel), en vez de reimplementar el patrón en cada uno.
export function ImageUploader({
  value,
  onChange,
  pathPrefix,
  maxFiles = 5,
  disabled,
  className,
  variant = "button",
  hideThumbnails,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const seleccionados = Array.from(files).slice(0, Math.max(maxFiles - value.length, 0))
    if (seleccionados.length === 0) return

    setUploading(true)
    try {
      const urls = await Promise.all(
        seleccionados.map(async (file) => {
          const comprimido = await compressToWebp(file)
          const path = `${pathPrefix}/${crypto.randomUUID()}-${comprimido.name}`
          const fileRef = ref(storage, path)
          await uploadBytes(fileRef, comprimido)
          return getDownloadURL(fileRef)
        })
      )
      onChange([...value, ...urls])
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!hideThumbnails && <ImageThumbnails value={value} onChange={onChange} disabled={disabled} />}

      {!disabled &&
        value.length < maxFiles &&
        (variant === "icon" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Agregar imágenes"
          >
            {uploading ? <Spinner className="size-4" /> : <Photo className="size-4" />}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Spinner className="size-4" /> : <Upload className="size-4" />}
            {uploading ? "Subiendo..." : "Agregar imágenes"}
          </Button>
        ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
