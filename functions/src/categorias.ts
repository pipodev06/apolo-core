import { onCall } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "./auth";

// Categorías de ticket con las que arranca una instalación nueva. Cubren los
// casos típicos de una mesa de ayuda de TI; se pueden renombrar, desactivar
// o borrar desde Administración → Categorías.
export const CATEGORIAS_BASE = [
  "Hardware",
  "Software",
  "Red e Internet",
  "Impresoras y escáneres",
  "Correo electrónico",
  "Accesos y contraseñas",
  "Telefonía",
  "Sistemas internos",
  "Seguridad informática",
  "Solicitud de equipo",
  "Otros",
] as const;

// Crea las categorías base que falten (compara por nombre, sin importar
// mayúsculas). No toca las existentes ni las que estén en la papelera.
export async function sembrarCategoriasBase(): Promise<number> {
  const db = getFirestore();
  const existentes = await db.collection("categorias").get();
  const nombres = new Set(
    existentes.docs.map((d) => String(d.data().nombre ?? "").trim().toLowerCase())
  );
  const faltantes = CATEGORIAS_BASE.filter((n) => !nombres.has(n.toLowerCase()));
  if (faltantes.length === 0) return 0;

  const batch = db.batch();
  for (const nombre of faltantes) {
    batch.set(db.collection("categorias").doc(), {
      nombre,
      activo: true,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  return faltantes.length;
}

// Botón "Cargar categorías sugeridas" de Administración → Categorías, para
// instalaciones creadas antes de que el setup sembrara las categorías.
export const cargarCategoriasBase = onCall(async (request) => {
  requireAdmin(request);
  const creadas = await sembrarCategoriasBase();
  return { creadas };
});
