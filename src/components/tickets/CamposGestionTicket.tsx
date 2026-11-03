import React, { useEffect } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import type { Ticket, TicketStatus } from "../../types/ticket";
import { Input } from "../ui/input";
import { Field, FieldLabel } from "../ui/field";
import { SelectOpciones } from "../ui/select-opciones";
import { useCatalogos } from "../../context/CatalogosContext";
import { useTickets } from "../../context/TicketsContext";
import { calcularCarga, estaOcupado } from "../../lib/carga";
import { STATUS_LABELS, transicionEstadoValida } from "../../lib/ticketStatus";
import type { TicketFormData } from "./TicketForm";
import { esTecnico } from "../../types/empleado";

const SIN_ASIGNAR = "__none__";

const URGENCIAS = [
  { value: "BAJO", label: "Bajo" },
  { value: "MEDIO", label: "Medio" },
  { value: "ALTO", label: "Alto" },
  { value: "CRITICO", label: "Crítico" },
];

const TODOS_LOS_ESTADOS = (Object.keys(STATUS_LABELS) as TicketStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

// Urgencia, estado y asignación de un ticket existente: solo admins (en
// TicketForm). Las opciones de "Asignar a" muestran la carga de cada técnico
// y se ordenan por carga ascendente (igual que la IA en analizarYAsignar).
export const CamposGestionTicket: React.FC<{
  control: Control<TicketFormData>;
  setValue: UseFormSetValue<TicketFormData>;
  ticket: Partial<Ticket>;
}> = ({ control, setValue, ticket }) => {
  const { empleados, empleadosListos: empleadosCargados } = useCatalogos();
  // Tickets viene de TicketsProvider (App.tsx) — un solo listener compartido
  // por sesión, en vez de pedir la colección entera cada vez.
  const { tickets, loading: ticketsLoading, maxTicketsAbiertos } = useTickets();
  // Sin esto el Select de "Asignar a" se pinta antes de tener la opción que
  // matchea ticket.assignedTo, y SelectValue muestra el id crudo.
  const empleadosListos = empleadosCargados && !ticketsLoading;

  // El Select de "Asignar a" se puebla de forma asíncrona (después del mount).
  // Se re-aplica el valor inicial una vez existen las opciones; si no, queda
  // en "Sin asignar" y al guardar se perdería la asignación.
  useEffect(() => {
    if (ticket.assignedTo && empleados.length > 0) setValue("assignedTo", ticket.assignedTo);
  }, [empleados, ticket.assignedTo, setValue]);

  // Técnicos activos + el asignado actual aunque ya no lo sea (para que su opción exista).
  const ticketsParaCarga = tickets.filter((t) => t.id !== ticket.id);
  const opcionesEmpleados = empleados
    .filter((e) => (e.activo && esTecnico(e)) || e.id === ticket.assignedTo)
    .map((e) => ({ ...e, carga: calcularCarga(ticketsParaCarga, e.id) }))
    .sort((a, b) => (a.carga !== b.carga ? a.carga - b.carga : a.nombre.localeCompare(b.nombre)))
    .map((e) => ({
      value: e.id,
      label: `${e.nombre}${e.cargo ? ` — ${e.cargo}` : ""}${
        estaOcupado(e.carga, maxTicketsAbiertos) ? " · Ocupado" : ` · ${e.carga} ${e.carga === 1 ? "abierto" : "abiertos"}`
      }${!e.activo ? " (inactivo)" : ""}`,
    }));
  // El empleado asignado pudo ser eliminado (ya no viene en la lista): sin
  // esta opción, el Select mostraría su id crudo.
  const asignadoEliminado = !!ticket.assignedTo && !empleados.some((e) => e.id === ticket.assignedTo);
  const opcionesAsignar = [
    { value: SIN_ASIGNAR, label: "Sin asignar" },
    ...(asignadoEliminado ? [{ value: ticket.assignedTo!, label: "Empleado eliminado" }] : []),
    ...opcionesEmpleados,
  ];

  // Sin saltos de estado hacia adelante (lib/ticketStatus.ts), comparado con
  // el estado guardado hoy. "Terminado" no se elige acá (cerrar exige
  // solución, en /tickets/:id/cerrar): solo se muestra si ya lo está.
  const estadoActual = ticket.status;
  const estadosDisponibles = estadoActual
    ? TODOS_LOS_ESTADOS.filter(
        (e) => transicionEstadoValida(estadoActual, e.value) && (e.value !== "terminado" || estadoActual === "terminado")
      )
    : TODOS_LOS_ESTADOS;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="urgency">Urgencia</FieldLabel>
          <Controller
            name="urgency"
            control={control}
            render={({ field }) => (
              <SelectOpciones id="urgency" opciones={URGENCIAS} value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="status">Estado</FieldLabel>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <SelectOpciones id="status" opciones={estadosDisponibles} value={field.value} onChange={field.onChange} />
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
              <SelectOpciones
                id="assignedTo"
                opciones={opcionesAsignar}
                value={field.value || SIN_ASIGNAR}
                onChange={(v) => field.onChange(v === SIN_ASIGNAR ? "" : v)}
              />
            )}
          />
        ) : (
          <Input id="assignedTo" disabled placeholder="Cargando personal..." />
        )}
        <p className="mt-1.5 text-sm text-muted-foreground">La hora de asignación se registra automáticamente.</p>
      </Field>
    </>
  );
};
