import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { analizarYAsignar } from "./analizar";

export { login } from "./auth";
export { registrarCambiosTicket, notificarEvento } from "./historial";

initializeApp();

const SAMBANOVA_API_KEY = defineSecret("SAMBANOVA_API_KEY");

const ROLES_ADMIN = ["admin", "super_admin"];

// request.auth.token viene del ID token verificado por Firebase (poblado tras
// signInWithCustomToken en el login); el rol ahí NO es falseable por el cliente,
// a diferencia del "role" que la UI guarda en localStorage solo para pintar la pantalla.
function requireAdmin(request: { auth?: { token?: Record<string, unknown> } }) {
  const role = request.auth?.token?.role;
  if (typeof role !== "string" || !ROLES_ADMIN.includes(role)) {
    throw new HttpsError("permission-denied", "Requiere rol de administrador.");
  }
}

export const asignarTicketIA = onDocumentCreated(
  { document: "tickets/{ticketId}", secrets: [SAMBANOVA_API_KEY] },
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
      apiKey: SAMBANOVA_API_KEY.value(),
      maxTicketsAbiertos: typeof config.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
    });
  }
);

// Re-ejecuta el análisis IA sobre un ticket ya existente: tanto tickets sin asignar
// (creados en modo manual antes de activar IA) como tickets ya asignados manualmente
// o por IA (reasigna, sobrescribiendo area/assignedTo/assignedAt). Se invoca a demanda
// desde el detalle del ticket, sin depender del modo global.
export const reanalizarTicketIA = onCall({ secrets: [SAMBANOVA_API_KEY] }, async (request) => {
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
    apiKey: SAMBANOVA_API_KEY.value(),
    maxTicketsAbiertos: typeof config?.maxTicketsAbiertos === "number" ? config.maxTicketsAbiertos : undefined,
  });
});

// Colecciones de Papelera con soft-delete (deletedAt): las reglas de Firestore
// prohíben `delete` desde el cliente en todas ellas a propósito (allow delete: if
// false), así que "eliminar definitivamente" solo puede hacerse aquí, vía Admin SDK.
const COLECCIONES_PAPELERA = ["users", "tickets", "personal", "cargos", "areas"] as const;
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

  await ref.delete();
  return { ok: true };
});
