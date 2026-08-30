import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconSend as Send } from "@tabler/icons-react";
import { eventosService } from "../../services/eventosService";
import type { TicketEvento } from "../../types/evento";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ExpandableText } from "../ui/expandable-text";
import { ImageUploader } from "../ui/image-uploader";
import { fmtFechaHora } from "../../lib/fecha";
import { notificarError } from "../../lib/alertas";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";

const LARGO_PREVIEW = 120;

export const ComentariosPanel: React.FC<{ ticketId: string; eventos: TicketEvento[]; className?: string }> = ({
  ticketId,
  eventos,
  className,
}) => {
  const { user } = useAuth();
  const [texto, setTexto] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const comentarios = useMemo(() => eventos.filter((e) => e.tipo === "comentario"), [eventos]);

  const listaRef = useRef<HTMLDivElement>(null);

  // Al abrir el detalle o al llegar un comentario nuevo, bajar directo al
  // último — como en un chat, en vez de arrancar en el más viejo.
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comentarios.length]);

  const handleComentar = async () => {
    if (!texto.trim() || !user) return;
    setEnviando(true);
    try {
      await eventosService.agregarComentario(ticketId, texto.trim(), user.userId, user.username, imagenes);
      setTexto("");
      setImagenes([]);
    } catch (error) {
      notificarError(error instanceof Error ? error.message : "Error al agregar el comentario");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className={cn("flex h-full flex-col p-6", className)}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">
        Comentarios
      </h3>

      <div ref={listaRef} className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
        {comentarios.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay comentarios.</p>
        )}
        {comentarios.map((evento) => {
          const esPropio = evento.actorId === user?.userId;
          return (
            <div key={evento.id} className="overflow-hidden rounded-md border">
              <div
                className={cn(
                  "px-2 py-1 text-center text-xs font-bold text-white",
                  esPropio ? "bg-green-600" : "bg-blue-600"
                )}
              >
                {esPropio ? "Tú" : evento.actorNombre}
              </div>
              <div className="p-2">
                <ExpandableText
                  texto={evento.texto ?? ""}
                  maxChars={LARGO_PREVIEW}
                  className="mt-0.5 whitespace-pre-wrap break-words text-sm"
                />
                {!!evento.imagenes?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evento.imagenes.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="h-14 w-14 rounded-md border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex justify-end">
                  <Badge variant="gray">{fmtFechaHora(evento.createdAt)}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-end gap-2 border-t pt-4">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleComentar();
            }
          }}
          placeholder="Agregar un comentario..."
          rows={1}
          className="min-h-9 flex-1 resize-none"
        />
        <ImageUploader
          value={imagenes}
          onChange={setImagenes}
          pathPrefix={`tickets/${ticketId}/comentarios`}
          maxFiles={3}
          variant="icon"
        />
        <Button onClick={handleComentar} disabled={enviando || !texto.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
