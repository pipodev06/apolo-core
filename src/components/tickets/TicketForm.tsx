import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Timestamp } from "firebase/firestore";
import type { Ticket, TicketStatus } from "../../types/ticket";
import type { Empleado } from "../../types/empleado";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { ImageUploader } from "../ui/image-uploader";
import { useAuth } from "../../context/AuthContext";
import { esAdmin } from "../../lib/roles";
import { empleadosService } from "../../services/empleadosService";
import { configService } from "../../services/configService";
import { useTickets } from "../../context/TicketsContext";
import { calcularCarga, estaOcupado } from "../../lib/carga";
import { transicionEstadoValida } from "../../lib/ticketStatus";
import { ahoraLimaInputValue } from "../../lib/fecha";

const ticketSchema = z.object({
  title: z.string().min(5, "Mínimo 5 caracteres"),
  description: z.string().min(10, "Mínimo 10 caracteres"),
  incidentTime: z.string().optional(),
  urgency: z.enum(["CRITICO", "ALTO", "MEDIO", "BAJO"]),
  status: z.enum(["pendiente", "asignado", "en_proceso", "terminado"]),
  assignedTo: z.string().optional(),
  problemImages: z.array(z.string()).optional(),
});

export type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  initialData?: Partial<Ticket>;
  onSubmit: (data: TicketFormData) => Promise<void>;
  loading?: boolean;
}

export const TicketForm: React.FC<TicketFormProps> = ({ initialData, onSubmit, loading }) => {
  const { user } = useAuth();
  const isAdmin = esAdmin(user?.role);
  // Ticket nuevo: solo título, hora y descripción — urgencia y personal los
  // determina la IA automáticamente tras crearse (o el admin, editando después).
  const isNew = !initialData?.id;
  const mostrarCamposAdmin = isAdmin && !isNew;
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  // Tickets viene de TicketsProvider (App.tsx) — un solo listener compartido
  // por sesión, en vez de que este form pida la colección entera cada vez
  // que se abre para crear/editar un ticket.
  const { tickets, loading: ticketsLoading } = useTickets();
  const [maxTicketsAbiertos, setMaxTicketsAbiertos] = useState<number | undefined>(undefined);
  // Igual que en TicketDetail.tsx/TicketsList.tsx: empleados se carga aparte
  // (fetch normal, no listener) y tarda mas que el mount del form — sin esto
  // el Select de "Asignar a" se pinta antes de tener la opcion que matchea
  // initialData.assignedTo, y SelectValue muestra el id crudo mientras tanto.
  const [empleadosCargados, setEmpleadosCargados] = useState(false);
  const empleadosListos = empleadosCargados && !ticketsLoading;
  // Un ticket nuevo todavía no tiene id (se genera recién al guardar, en la
  // transacción de ticketsService.create) — usamos uno temporal solo para
  // agrupar las imágenes en Storage; no necesita corresponder a un doc real.
  const [tempTicketId] = useState(() => crypto.randomUUID());
  const storageTicketId = initialData?.id || tempTicketId;

  useEffect(() => {
    if (!mostrarCamposAdmin) return;
    Promise.all([empleadosService.getAll(), configService.getAppConfig().catch(() => null)])
      .then(([empleadosData, config]) => {
        setEmpleados(empleadosData);
        setMaxTicketsAbiertos(config?.maxTicketsAbiertos);
      })
      .catch(() => {})
      .finally(() => setEmpleadosCargados(true));
  }, [mostrarCamposAdmin]);

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
      problemImages: initialData?.problemImages || [],
    },
  });

  // El <select> de "Asignar a" se puebla de forma asíncrona (después del mount).
  // Re-aplicamos el valor inicial una vez existen las <option>, si no, el navegador
  // no encuentra coincidencia y el select queda en "Sin asignar" aunque el ticket
  // sí tenga assignedTo, provocando que al guardar se pierda la asignación.
  useEffect(() => {
    if (initialData?.assignedTo && empleados.length > 0) {
      setValue("assignedTo", initialData.assignedTo);
    }
  }, [empleados, initialData?.assignedTo, setValue]);

  // Empleados seleccionables: activos + el actualmente asignado aunque esté inactivo,
  // para que siempre exista una <option> que respalde el valor guardado en el ticket.
  // Ordenados por carga ascendente (igual que la IA en analizarYAsignar) para que,
  // aunque la elección final sea manual, el admin vea primero a los menos ocupados.
  const ticketsParaCarga = tickets.filter((t) => t.id !== initialData?.id);
  const empleadosSeleccionables = empleados
    .filter((e) => e.activo || e.id === initialData?.assignedTo)
    .map((e) => ({ ...e, carga: calcularCarga(ticketsParaCarga, e.id) }))
    .sort((a, b) => (a.carga !== b.carga ? a.carga - b.carga : a.nombre.localeCompare(b.nombre)));

  // No dejar elegir un salto de estado hacia adelante invalido (ver
  // lib/ticketStatus.ts) — comparado contra el status que el ticket tiene
  // guardado hoy, no contra lo que haya en el form sin guardar todavia.
  const todosLosEstados: { value: TicketStatus; label: string }[] = [
    { value: "pendiente", label: "Pendiente" },
    { value: "asignado", label: "Asignado" },
    { value: "en_proceso", label: "En Proceso" },
    { value: "terminado", label: "Terminado" },
  ];
  const estadoActual = initialData?.status;
  const estadosDisponibles = estadoActual
    ? todosLosEstados.filter((e) => transicionEstadoValida(estadoActual, e.value))
    : todosLosEstados;

  const submit = (data: TicketFormData) =>
    onSubmit({
      ...data,
      title: data.title.toUpperCase(),
      incidentTime: data.incidentTime && data.incidentTime.length > 0
        ? data.incidentTime
        : ahoraLimaInputValue(),
    });

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

        {/* Fila 4 — Imágenes del problema */}
        <Field>
          <FieldLabel>Imágenes del problema</FieldLabel>
          <Controller
            name="problemImages"
            control={control}
            render={({ field }) => (
              <ImageUploader
                value={field.value || []}
                onChange={field.onChange}
                pathPrefix={`tickets/${storageTicketId}/problema`}
              />
            )}
          />
        </Field>

        {mostrarCamposAdmin ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="urgency">Urgencia</FieldLabel>
                <Controller
                  name="urgency"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={[
                        { value: "BAJO", label: "Bajo" },
                        { value: "MEDIO", label: "Medio" },
                        { value: "ALTO", label: "Alto" },
                        { value: "CRITICO", label: "Crítico" },
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="urgency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="BAJO">Bajo</SelectItem>
                          <SelectItem value="MEDIO">Medio</SelectItem>
                          <SelectItem value="ALTO">Alto</SelectItem>
                          <SelectItem value="CRITICO">Crítico</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="status">Estado</FieldLabel>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={estadosDisponibles}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {estadosDisponibles.map((e) => (
                            <SelectItem key={e.value} value={e.value}>
                              {e.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="assignedTo">Asignar a</FieldLabel>
              {empleadosListos ? (
                <Controller
                  name="assignedTo"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={[
                        { value: "__none__", label: "Sin asignar" },
                        ...empleadosSeleccionables.map((e) => ({
                          value: e.id,
                          label: `${e.nombre}${e.cargo ? ` — ${e.cargo}` : ""}${
                            estaOcupado(e.carga, maxTicketsAbiertos)
                              ? " · Ocupado"
                              : ` · ${e.carga} ${e.carga === 1 ? "abierto" : "abiertos"}`
                          }${!e.activo ? " (inactivo)" : ""}`,
                        })),
                      ]}
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger id="assignedTo" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__none__">Sin asignar</SelectItem>
                          {empleadosSeleccionables.map((e) => {
                            const ocupado = estaOcupado(e.carga, maxTicketsAbiertos);
                            return (
                              <SelectItem key={e.id} value={e.id}>
                                {e.nombre}
                                {e.cargo ? ` — ${e.cargo}` : ""}
                                {ocupado ? " · Ocupado" : ` · ${e.carga} ${e.carga === 1 ? "abierto" : "abiertos"}`}
                                {!e.activo ? " (inactivo)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Input id="assignedTo" disabled placeholder="Cargando personal..." />
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                La hora de asignación se registra automáticamente.
              </p>
            </Field>
          </>
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
