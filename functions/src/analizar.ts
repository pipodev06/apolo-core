import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { analizarTicket } from "./sambanova";

const OPEN_STATUSES = ["asignado", "en_proceso"];

interface AnalizarYAsignarParams {
  db: FirebaseFirestore.Firestore;
  ticketId: string;
  ticketRef: FirebaseFirestore.DocumentReference;
  title: string;
  description: string;
  apiKey: string;
}

export interface ResultadoAnalisis {
  ok: boolean;
  motivo?: string;
}

/**
 * Clasifica un ticket (área + urgencia) con SambaNova y, si encuentra
 * empleados activos en el área elegida, lo asigna al de menor carga.
 * Usado tanto por el trigger de creación como por la re-ejecución manual.
 */
export async function analizarYAsignar(params: AnalizarYAsignarParams): Promise<ResultadoAnalisis> {
  const { db, ticketId, ticketRef, title, description, apiKey } = params;

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
    logger.error(`Ticket ${ticketId}: fallo al llamar SambaNova`, err);
    return { ok: false, motivo: "Error al llamar a SambaNova." };
  }

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (analisis.urgencia) {
    update.urgency = analisis.urgencia;
  } else {
    logger.warn(`Ticket ${ticketId}: SambaNova no devolvió una urgencia válida`);
  }

  if (!analisis.area) {
    logger.warn(`Ticket ${ticketId}: SambaNova no devolvió un área válida`);
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
    const asignado = t.data().assignedTo as string | undefined;
    if (!asignado) continue;
    cargaPorEmpleado.set(asignado, (cargaPorEmpleado.get(asignado) ?? 0) + 1);
  }

  empleados.sort((a, b) => {
    const cargaA = cargaPorEmpleado.get(a.id) ?? 0;
    const cargaB = cargaPorEmpleado.get(b.id) ?? 0;
    if (cargaA !== cargaB) return cargaA - cargaB;
    return a.nombre.localeCompare(b.nombre);
  });

  const elegido = empleados[0];

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
