import "./opciones";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { analizarYAsignar } from "./analizar";

import { requireAdmin } from "./auth";

export { adminCuentas } from "./auth";

initializeApp();

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

// Máximo de tickets por usuario por hora que la IA analiza solos; los que
// pasen quedan sin asignar (un admin puede asignarlos o usar "Analizar con IA").
const MAX_TICKETS_IA_POR_HORA = 10;

export const asignarTicketIA = onDocumentCreated(
  { document: "tickets/{ticketId}", secrets: [GROQ_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const ticket = snap.data();
    if (ticket.assignedTo) return; // ya viene asignado (creado/editado manualmente)

    const db = getFirestore();

    const configDoc = await db.collection("config").doc("app").get();
    const config = configDoc.data();
    if (config?.assignmentMode !== "ia") {
      logger.info(`Ticket ${snap.id}: asignación en modo manual, no se analiza con IA`);
      return;
    }

    // Tope anti-abuso: si quien lo creó ya hizo demasiados tickets en la
    // última hora, no se gasta la IA (la cuota diaria de Groq es compartida).
    // count() cuesta 1 lectura por cada 1,000 tickets, no lee los documentos.
    const haceUnaHora = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const recientes = await db
      .collection("tickets")
      .where("createdBy", "==", ticket.createdBy)
      .where("createdAt", ">=", haceUnaHora)
      .count()
      .get();
    if (recientes.data().count > MAX_TICKETS_IA_POR_HORA) {
      logger.warn(
        `Ticket ${snap.id}: ${ticket.createdBy} creó más de ${MAX_TICKETS_IA_POR_HORA} tickets en la última hora, no se analiza con IA`
      );
      return;
    }

    await analizarYAsignar({
      db,
      ticketId: snap.id,
      ticketRef: snap.ref,
      ticket,
      apiKey: GROQ_API_KEY.value(),
      maxTicketsAbiertos: typeof config.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
    });
  }
);

// Re-ejecuta el análisis IA sobre un ticket ya existente: tanto tickets sin asignar
// (creados en modo manual antes de activar IA) como tickets ya asignados manualmente
// o por IA (reasigna, sobrescribiendo area/assignedTo/assignedAt). Se invoca a demanda
// desde el detalle del ticket, sin depender del modo global.
export const reanalizarTicketIA = onCall({ secrets: [GROQ_API_KEY] }, async (request) => {
  await requireAdmin(request);

  const ticketId = request.data?.ticketId;
  if (!ticketId || typeof ticketId !== "string") {
    throw new HttpsError("invalid-argument", "Falta ticketId.");
  }

  const db = getFirestore();
  const ticketRef = db.collection("tickets").doc(ticketId);
  const ticketDoc = await ticketRef.get();
  if (!ticketDoc.exists) {
    throw new HttpsError("not-found", "Ticket no encontrado.");
  }

  const ticket = ticketDoc.data()!;
  if (ticket.status === "terminado") {
    throw new HttpsError("failed-precondition", "No se puede reanalizar un ticket terminado.");
  }

  const configDoc = await db.collection("config").doc("app").get();
  const config = configDoc.data();

  return analizarYAsignar({
    db,
    ticketId,
    ticketRef,
    ticket,
    apiKey: GROQ_API_KEY.value(),
    maxTicketsAbiertos: typeof config?.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
  });
});
