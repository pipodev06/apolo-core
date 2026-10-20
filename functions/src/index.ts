import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { analizarYAsignar } from "./analizar";

import { requireAdmin } from "./auth";

export { login, setupInicial, estadoSistema, crearUsuario, cambiarPassword, revocarSesionesUsuario } from "./auth";
export { cargarCategoriasBase } from "./categorias";
export { registrarCambiosTicket, notificarEvento, notificarTicketNuevo, expirarNotificacionLeida } from "./historial";

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
      title: ticket.title ?? "",
      description: ticket.description ?? "",
      apiKey: GROQ_API_KEY.value(),
      maxTicketsAbiertos: typeof config.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
      statusActual: ticket.status,
      categoriaActual: ticket.categoria,
    });
  }
);

// Re-ejecuta el análisis IA sobre un ticket ya existente: tanto tickets sin asignar
// (creados en modo manual antes de activar IA) como tickets ya asignados manualmente
// o por IA (reasigna, sobrescribiendo area/assignedTo/assignedAt). Se invoca a demanda
// desde el detalle del ticket, sin depender del modo global.
export const reanalizarTicketIA = onCall({ secrets: [GROQ_API_KEY] }, async (request) => {
  requireAdmin(request);

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
    title: ticket.title ?? "",
    description: ticket.description ?? "",
    apiKey: GROQ_API_KEY.value(),
    maxTicketsAbiertos: typeof config?.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
    statusActual: ticket.status,
    assignedToActual: ticket.assignedTo,
    categoriaActual: ticket.categoria,
  });
});

// Colecciones de Papelera con soft-delete (deletedAt): las reglas de Firestore
// prohíben `delete` desde el cliente en todas ellas a propósito (allow delete: if
// false), así que "eliminar definitivamente" solo puede hacerse aquí, vía Admin SDK.
const COLECCIONES_PAPELERA = ["users", "tickets", "personal", "cargos", "areas", "categorias"] as const;
type ColeccionPapelera = (typeof COLECCIONES_PAPELERA)[number];

export const eliminarDefinitivo = onCall(async (request) => {
  requireAdmin(request);

  const coleccion = request.data?.coleccion;
  const id = request.data?.id;
  if (
    typeof coleccion !== "string" ||
    !COLECCIONES_PAPELERA.includes(coleccion as ColeccionPapelera) ||
    typeof id !== "string" ||
    !id
  ) {
    throw new HttpsError("invalid-argument", "Faltan datos válidos (coleccion, id).");
  }

  const db = getFirestore();
  const ref = db.collection(coleccion).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "El documento no existe.");
  }
  // Solo se permite el borrado físico de algo que ya pasó por el soft-delete
  // primero (papelera) — evita que "eliminar definitivo" se use como atajo
  // para saltarse el flujo normal de papelera sobre un doc activo.
  if (!snap.data()?.deletedAt) {
    throw new HttpsError(
      "failed-precondition",
      "Solo se puede eliminar definitivamente algo que ya está en la papelera."
    );
  }

  if (coleccion === "users") {
    const data = snap.data();
    if ((data?.role === "super_admin" || data?.protegida === true) && request.auth?.token?.role !== "super_admin") {
      throw new HttpsError("permission-denied", "Solo un super admin puede eliminar esta cuenta.");
    }
  }

  await ref.delete();
  // Una cuenta borrada se lleva su credencial, su matriz de accesos y su
  // usuario de Firebase Auth (así no queda ninguna sesión viva).
  if (coleccion === "users") {
    await Promise.all([
      db.collection("credenciales").doc(id).delete(),
      db.collection("access").doc(id).delete(),
      getAuth().deleteUser(id).catch(() => {}),
    ]);
  }
  return { ok: true };
});
