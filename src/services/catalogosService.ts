import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { Catalogo } from "../types/catalogo";

// Firestore corta un WriteBatch a los 500 writes — se trocea por las dudas,
// aunque en la práctica un catálogo (cargos/áreas) nunca debería acercarse.
const TAMANO_LOTE = 450;

interface Cascada {
  coleccion: string; // colección que referencia el nombre por string (ej. "personal")
  campo: string; // campo de esa colección que guarda el nombre (ej. "area", "cargo")
}

// Propaga el renombre de un catálogo (cargo/área) a todo lo que lo referencia
// por nombre — Empleado.area/cargo y Ticket.area son strings sueltos, no ids,
// así que sin esto un renombre deja a todo el mundo con el nombre viejo,
// desincronizado (ej. deja de matchear en la asignación por IA).
async function propagarRenombre(cascadas: Cascada[], campoViejo: string, nombreNuevo: string) {
  for (const { coleccion, campo } of cascadas) {
    const q = query(collection(db, coleccion), where(campo, "==", campoViejo));
    const snap = await getDocs(q);
    if (snap.empty) continue;

    for (let i = 0; i < snap.docs.length; i += TAMANO_LOTE) {
      const lote = writeBatch(db);
      for (const d of snap.docs.slice(i, i + TAMANO_LOTE)) {
        lote.update(d.ref, { [campo]: nombreNuevo, updatedAt: serverTimestamp() });
      }
      await lote.commit();
    }
  }
}

// Factory de servicio CRUD para catálogos simples (soft-delete + activo).
// `cascadas`: qué otras colecciones referencian el nombre de este catálogo
// por string, para propagar el renombre (ver propagarRenombre arriba).
export function crearCatalogoService(coleccion: string, cascadas: Cascada[] = []) {
  return {
    getAll: async (): Promise<Catalogo[]> => {
      const ref = collection(db, coleccion);
      const q = query(ref, orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Catalogo))
        .filter((c) => !c.deletedAt);
    },

    create: async (nombre: string) => {
      await addDoc(collection(db, coleccion), {
        nombre,
        activo: true,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    update: async (id: string, nombre: string) => {
      const ref = doc(db, coleccion, id);
      const nombreViejo = (await getDoc(ref)).data()?.nombre as string | undefined;
      await updateDoc(ref, { nombre, updatedAt: serverTimestamp() });
      if (nombreViejo && nombreViejo !== nombre && cascadas.length > 0) {
        await propagarRenombre(cascadas, nombreViejo, nombre);
      }
    },

    toggleActivo: async (id: string, current: boolean) => {
      await updateDoc(doc(db, coleccion, id), { activo: !current, updatedAt: serverTimestamp() });
    },

    delete: async (id: string) => {
      await updateDoc(doc(db, coleccion, id), {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    listarPapelera: async (): Promise<Catalogo[]> => {
      const ref = collection(db, coleccion);
      const q = query(ref, orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Catalogo))
        .filter((c) => !!c.deletedAt);
    },

    restaurar: async (id: string) => {
      await updateDoc(doc(db, coleccion, id), { deletedAt: null, updatedAt: serverTimestamp() });
    },

    eliminarDefinitivo: async (id: string) => {
      const fn = httpsCallable(functions, "eliminarDefinitivo");
      await fn({ coleccion, id });
    },
  };
}

export type CatalogoService = ReturnType<typeof crearCatalogoService>;

export const cargosService = crearCatalogoService("cargos", [{ coleccion: "personal", campo: "cargo" }]);
export const areasService = crearCatalogoService("areas", [
  { coleccion: "personal", campo: "area" },
  { coleccion: "tickets", campo: "area" },
]);
