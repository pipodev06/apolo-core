import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { analizarTicket } from "./groq";

const OPEN_STATUSES = ["asignado", "en_proceso"];

interface AnalizarYAsignarParams {
  db: FirebaseFirestore.Firestore;
  ticketId: string;
  ticketRef: FirebaseFirestore.DocumentReference;
  title: string;
  description: string;
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
  const { db, ticketId, ticketRef, title, description, apiKey, maxTicketsAbiertos } = params;

  const areasSnap = await db.collection("areas").where("activo", "==", true).get();
  const areas = areasSnap.docs.flatMap((d) => {
    const nombre = d.data().nombre as string | undefined;
    return nombre ? [nombre] : [];
  });
  if (areas.length === 0) {
    logger.warn(`Ticket ${ticketId}: sin áreas activas, no se puede analizar por IA`);
    return { ok: false, motivo: "No hay áreas activas configuradas." };
  }

  let analisis;
  try {
    analisis = await analizarTicket({ apiKey, titulo: title, descripcion: description, areas });
  } catch (err) {
    logger.error(`Ticket ${ticketId}: fallo al llamar Groq`, err);
    return { ok: false, motivo: "Error al llamar a Groq." };
  }

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (analisis.urgencia) {
    update.urgency = analisis.urgencia;
  } else {
    logger.warn(`Ticket ${ticketId}: Groq no devolvió una urgencia válida`);
  }

  if (!analisis.area) {
    logger.warn(`Ticket ${ticketId}: Groq no devolvió un área válida`);
    await ticketRef.update(update);
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
    return { ok: false, motivo: `El área "${analisis.area}" no tiene empleados activos.` };
  }

  const empleados = empleadosSnap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre as string }));

  const ticketsAbiertosSnap = await db.collection("tickets").where("status", "in", OPEN_STATUSES).get();
  const cargaPorEmpleado = new Map<string, number>();
  for (const t of ticketsAbiertosSnap.docs) {
    if (t.id === ticketId) continue; // no contar la asignación previa del propio ticket al reanalizar
    if (t.data().deletedAt) continue; // no contar tickets en la papelera como carga real
    const asignado = t.data().assignedTo as string | undefined;
    if (!asignado) continue;
    cargaPorEmpleado.set(asignado, (cargaPorEmpleado.get(asignado) ?? 0) + 1);
  }

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
  update.assignedTo = elegido.id;
  update.assignedAt = FieldValue.serverTimestamp();
  update.status = "asignado";
  await ticketRef.update(update);

  logger.info(
    `Ticket ${ticketId} asignado por IA a ${elegido.nombre} (${elegido.id}) en área "${analisis.area}"`
  );
  return { ok: true };
}
