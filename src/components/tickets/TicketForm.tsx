import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Timestamp } from "firebase/firestore";
import type { Ticket } from "../../types/ticket";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../ui/input-group";
import { Textarea } from "../ui/textarea";
import { ImageUploader } from "../ui/image-uploader";
import { useAuth } from "../../context/AuthContext";
import { useAccess } from "../../context/AccessContext";
import { esAdmin } from "../../lib/roles";
import { CategoriaField } from "./CategoriaField";
import { CamposGestionTicket } from "./CamposGestionTicket";
import { useImagenesSinGuardar } from "../../lib/useImagenesSinGuardar";
import { ahoraLimaInputValue } from "../../lib/fecha";

const ticketSchema = z.object({
  title: z.string().min(5, "Mínimo 5 caracteres"),
  description: z.string().min(10, "Mínimo 10 caracteres"),
  incidentTime: z.string().optional(),
  urgency: z.enum(["CRITICO", "ALTO", "MEDIO", "BAJO"]),
  status: z.enum(["pendiente", "asignado", "en_proceso", "terminado"]),
  assignedTo: z.string().optional(),
  categoria: z.string().optional(),
  problemImages: z.array(z.string()).optional(),
});

export type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  initialData?: Partial<Ticket>;
  // Devuelve true si se guardó (recién ahí se confirman las imágenes).
  onSubmit: (data: TicketFormData) => Promise<boolean>;
  loading?: boolean;
}

export const TicketForm: React.FC<TicketFormProps> = ({ initialData, onSubmit, loading }) => {
  const { user } = useAuth();
  const puedeSubirImagenes = useAccess().hasAccess("subirImagenes");
  const imagenes = useImagenesSinGuardar();
  const isAdmin = esAdmin(user?.role);
  // Ticket nuevo: solo título, hora y descripción — urgencia y personal los
  // determina la IA automáticamente tras crearse (o el admin, editando después).
  const isNew = !initialData?.id;
  const mostrarCamposAdmin = isAdmin && !isNew;
  // Un ticket nuevo todavía no tiene id (se genera recién al guardar, en la
  // transacción de ticketsService.create) — usamos uno temporal solo para
  // agrupar las imágenes en Storage; no necesita corresponder a un doc real.
  const [tempTicketId] = useState(() => crypto.randomUUID());
  const storageTicketId = initialData?.id || tempTicketId;

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      incidentTime: initialData?.incidentTime
        ? ahoraLimaInputValue(
            initialData.incidentTime instanceof Timestamp
              ? initialData.incidentTime.toDate()
              : new Date(initialData.incidentTime)
          )
        : ahoraLimaInputValue(),
      urgency: initialData?.urgency || "MEDIO",
      status: initialData?.status || "pendiente",
      assignedTo: initialData?.assignedTo || "",
      categoria: initialData?.categoria || "",
      problemImages: initialData?.problemImages || [],
    },
  });

  const submit = async (data: TicketFormData) => {
    const guardado = await onSubmit({
      ...data,
      title: data.title.toUpperCase(),
      incidentTime: data.incidentTime && data.incidentTime.length > 0
        ? data.incidentTime
        : ahoraLimaInputValue(),
    });
    if (guardado) imagenes.alGuardar();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <Card className="space-y-4 p-6">
        {/* Fila 1 — Título */}
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">Título de la incidencia</FieldLabel>
          <Input
            id="title"
            placeholder="ej. El servidor no responde"
            className="uppercase placeholder:normal-case"
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        {/* Fila 2 — Fecha y hora del incidente */}
        <Field data-invalid={!!errors.incidentTime}>
          <FieldLabel htmlFor="incidentTime">Fecha y hora del incidente</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="incidentTime"
              type="datetime-local"
              className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
              aria-invalid={!!errors.incidentTime}
              {...register("incidentTime")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                onClick={() => setValue("incidentTime", ahoraLimaInputValue())}
              >
                Hoy
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError errors={[errors.incidentTime]} />
        </Field>

        {/* Fila 3 — Descripción */}
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Descripción detallada</FieldLabel>
          <Textarea
            id="description"
            className="min-h-[120px]"
            placeholder="Describe el problema con el mayor detalle posible..."
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          <FieldError errors={[errors.description]} />
        </Field>

        <CategoriaField control={control} categoriaActual={initialData?.categoria} />

        {/* Fila 4 — Imágenes del problema (solo con permiso "Subir imágenes") */}
        {puedeSubirImagenes && (
          <Field>
            <FieldLabel>Imágenes del problema</FieldLabel>
            <Controller
              name="problemImages"
              control={control}
              render={({ field }) => (
                <ImageUploader
                  value={field.value || []}
                  onChange={field.onChange}
                  sesion={imagenes}
                  pathPrefix={`tickets/${storageTicketId}/problema`}
                />
              )}
            />
          </Field>
        )}

        {mostrarCamposAdmin ? (
          <CamposGestionTicket control={control} setValue={setValue} ticket={initialData!} />
        ) : (
          <>
            <input type="hidden" {...register("urgency")} />
            <input type="hidden" {...register("status")} />
            <input type="hidden" {...register("assignedTo")} />
          </>
        )}
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar Ticket"}
        </Button>
      </div>
    </form>
  );
};
