import * as React from "react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { IconUpload as Upload, IconX as X } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { storage } from "@/firebase"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  pathPrefix: string
  maxFiles?: number
  disabled?: boolean
  className?: string
}

// Componente único de carga/preview de imágenes — se reusa en imágenes de
// problema (TicketForm), de solución (CierreTicketPanel) y de comentarios
// (ComentariosPanel), en vez de reimplementar el patrón en cada uno.
export function ImageUploader({
  value,
  onChange,
  pathPrefix,
  maxFiles = 5,
  disabled,
  className,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const seleccionados = Array.from(files).slice(0, Math.max(maxFiles - value.length, 0))
    if (seleccionados.length === 0) return

    setUploading(true)
    try {
      const urls = await Promise.all(
        seleccionados.map(async (file) => {
          const path = `${pathPrefix}/${crypto.randomUUID()}-${file.name}`
          const fileRef = ref(storage, path)
          await uploadBytes(fileRef, file)
          return getDownloadURL(fileRef)
        })
      )
      onChange([...value, ...urls])
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const quitar = (url: string) => onChange(value.filter((u) => u !== url))

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
      )}

      {!disabled && value.length < maxFiles && (
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
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          {preview && <img src={preview} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
