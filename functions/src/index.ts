import "./opciones";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { analizarYAsignar } from "./analizar";

import { requireAdmin } from "./auth";

export { resetearPassword, cambiarUsername } from "./auth";

initializeApp();

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

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
    if (config?.assignmentMode !== "ia") return;

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

// Borrado definitivo de una cuenta que ya está en la papelera: además del
// doc en users se lleva su matriz de accesos y su usuario de Firebase Auth
// (así no queda ninguna sesión viva y el nombre de usuario se libera). Lo
// demás de la papelera (tickets, personal, catálogos) se borra desde el
// cliente: las reglas lo permiten a un admin si el doc tiene deletedAt.
export const eliminarCuenta = onCall(async (request) => {
  const rol = await requireAdmin(request);

  const id = request.data?.id;
  if (typeof id !== "string" || !id) {
    throw new HttpsError("invalid-argument", "Falta el id de la cuenta.");
  }

  const db = getFirestore();
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "La cuenta no existe.");
  }
  const data = snap.data();
  if (!data?.deletedAt) {
    throw new HttpsError(
      "failed-precondition",
      "Solo se puede eliminar definitivamente una cuenta que ya está en la papelera."
    );
  }
  if ((data.role === "super_admin" || data.protegida === true) && rol !== "super_admin") {
    throw new HttpsError("permission-denied", "Solo un super admin puede eliminar esta cuenta.");
  }

  await ref.delete();
  await Promise.all([
    db.collection("access").doc(id).delete(),
    getAuth().deleteUser(id).catch(() => {}),
  ]);
  return { ok: true };
});
