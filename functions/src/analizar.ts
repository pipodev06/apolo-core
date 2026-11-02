import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { analizarTicket } from "./groq";
import { registrarCambiosIA } from "./historial";

const OPEN_STATUSES = ["asignado", "en_proceso"];

interface AnalizarYAsignarParams {
  db: FirebaseFirestore.Firestore;
  ticketId: string;
  ticketRef: FirebaseFirestore.DocumentReference;
  // Datos actuales del ticket: título/descripción para la IA y estado,
  // urgencia, asignación y categoría previos para el historial.
  ticket: FirebaseFirestore.DocumentData;
  apiKey: string;
  // Techo de carga (tickets abiertos) por empleado, desde config/app. Si no
  // se pasa, no se filtra por ocupación — todos cuentan como disponibles.
  maxTicketsAbiertos?: number;
}

export interface ResultadoAnalisis {
  ok: boolean;
  motivo?: string;
}

/**
 * Clasifica un ticket (área + urgencia) con Groq y, si encuentra
 * empleados activos en el área elegida, lo asigna al de menor carga.
 * Usado tanto por el trigger de creación como por la re-ejecución manual.
 */
export async function analizarYAsignar(params: AnalizarYAsignarParams): Promise<ResultadoAnalisis> {
  const { db, ticketId, ticketRef, ticket, apiKey, maxTicketsAbiertos } = params;
  const title = (ticket.title as string | undefined) ?? "";
  const description = (ticket.description as string | undefined) ?? "";
  // Si al reanalizar la IA elige al mismo técnico, el ticket conserva su
  // estado (no retrocede en_proceso → asignado).
  const statusActual = ticket.status as string | undefined;
  const assignedToActual = ticket.assignedTo as string | undefined;
  // Categoría elegida por quien creó el ticket: si ya tiene una, la IA no la
  // pisa; si no tiene, la IA sugiere una de las categorías activas.
  const categoriaActual = ticket.categoria as string | undefined;

  const areasSnap = await db.collection("areas").where("activo", "==", true).get();
  const areas = areasSnap.docs.flatMap((d) => {
    const nombre = d.data().nombre as string | undefined;
    return nombre ? [nombre] : [];
  });
  if (areas.length === 0) {
    logger.warn(`Ticket ${ticketId}: sin áreas activas, no se puede analizar por IA`);
    return { ok: false, motivo: "No hay áreas activas configuradas." };
  }

  // Solo se pide categoría a la IA si el ticket todavía no tiene una.
  const categorias = categoriaActual
    ? []
    : (await db.collection("categorias").where("activo", "==", true).get()).docs.flatMap((d) => {
        const data = d.data();
        return typeof data.nombre === "string" && !data.deletedAt ? [data.nombre] : [];
      });

  let analisis;
  try {
    analisis = await analizarTicket({ apiKey, titulo: title, descripcion: description, areas, categorias });
  } catch (err) {
    logger.error(`Ticket ${ticketId}: fallo al llamar Groq`, err);
    return { ok: false, motivo: "Error al llamar a Groq." };
  }

  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    // Firma para el historial de actividad (ver registrarCambiosTicket).
    modificadoPor: { tipo: "ia", nombre: "Asistente IA", en: FieldValue.serverTimestamp() },
  };
  if (analisis.urgencia) {
    update.urgency = analisis.urgencia;
  } else {
    logger.warn(`Ticket ${ticketId}: Groq no devolvió una urgencia válida`);
  }
  if (analisis.categoria) update.categoria = analisis.categoria;

  if (!analisis.area) {
    logger.warn(`Ticket ${ticketId}: Groq no devolvió un área válida`);
    await ticketRef.update(update);
    await registrarCambiosIA(db, ticketId, ticket, update);
    return { ok: false, motivo: "La IA no pudo determinar el área del ticket." };
  }

  const empleadosSnap = await db
    .collection("personal")
    .where("area", "==", analisis.area)
    .where("activo", "==", true)
    .get();

  if (empleadosSnap.empty) {
    logger.warn(`Ticket ${ticketId}: área "${analisis.area}" sin empleados activos`);
    update.area = analisis.area;
    await ticketRef.update(update);
    await registrarCambiosIA(db, ticketId, ticket, update);
    return { ok: false, motivo: `El área "${analisis.area}" no tiene empleados activos.` };
  }

  const empleados = empleadosSnap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre as string }));

  // Carga = tickets abiertos (asignado/en_proceso, fuera de la papelera) de
  // cada técnico del área, con count(): cuesta ~1 lectura por técnico en vez
  // de leer todos los tickets abiertos (que crecía con el volumen). Necesita
  // el índice tickets(assignedTo, deletedAt, status).
  const conteos = await Promise.all(
    empleados.map((e) =>
      db
        .collection("tickets")
        .where("assignedTo", "==", e.id)
        .where("deletedAt", "==", null)
        .where("status", "in", OPEN_STATUSES)
        .count()
        .get()
    )
  );
  // Al reanalizar, el propio ticket ya cuenta en la carga de su técnico
  // actual: se descuenta para no penalizarlo por la asignación que se revisa.
  const propioAbierto = !!assignedToActual && OPEN_STATUSES.includes(statusActual ?? "") && !ticket.deletedAt;
  const cargaPorEmpleado = new Map(
    empleados.map((e, i) => [e.id, conteos[i].data().count - (propioAbierto && e.id === assignedToActual ? 1 : 0)])
  );

  const cargaDe = (id: string) => cargaPorEmpleado.get(id) ?? 0;
  empleados.sort((a, b) => {
    const cargaA = cargaDe(a.id);
    const cargaB = cargaDe(b.id);
    if (cargaA !== cargaB) return cargaA - cargaB;
    return a.nombre.localeCompare(b.nombre);
  });

  // Techo de carga (soft cap): entre los NO ocupados (carga < máximo) elige
  // el de menor carga. Si todos están al tope, no deja el ticket sin asignar
  // — igual asigna al de menor carga general (el "menos peor"), pero queda
  // registrado en el log para que se note que el área está saturada.
  const disponibles =
    maxTicketsAbiertos != null ? empleados.filter((e) => cargaDe(e.id) < maxTicketsAbiertos) : empleados;

  if (maxTicketsAbiertos != null && disponibles.length === 0) {
    logger.warn(
      `Ticket ${ticketId}: todos los empleados del área "${analisis.area}" están al tope de carga (>= ${maxTicketsAbiertos}), se asigna igual al de menor carga`
    );
  }

  const elegido = (disponibles.length > 0 ? disponibles : empleados)[0];

  update.area = analisis.area;
  if (elegido.id !== assignedToActual) {
    update.assignedTo = elegido.id;
    update.assignedAt = FieldValue.serverTimestamp();
    update.status = "asignado";
  } else if (statusActual === "pendiente") {
    update.status = "asignado";
  }
  await ticketRef.update(update);
  await registrarCambiosIA(db, ticketId, ticket, update, elegido.nombre);

  logger.info(
    `Ticket ${ticketId} asignado por IA a ${elegido.nombre} (${elegido.id}) en área "${analisis.area}"`
  );
  return { ok: true };
}
