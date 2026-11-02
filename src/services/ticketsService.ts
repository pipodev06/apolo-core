import {
  collection,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  writeBatch,
  type UpdateData
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, deleteObject } from "firebase/storage";
import { esImagenDeTicket } from "../lib/useImagenesSinGuardar";
import { auth, db, functions, storage } from "../firebase";
import type { Ticket } from "../types/ticket";
import { generateTicketCode } from "../lib/ticketNumber";
import { esAdmin } from "../lib/roles";
import { IA_CREATED_BY, cambiosDeTicket, mensajeTicketNuevo, truncar } from "../lib/historial";
import {
  adminsActivos,
  agregarEvento,
  agregarNotificaciones,
  nombresDeEmpleados,
  usuariosDeEmpleado,
} from "./historialService";

const MAX_ADMINS_AVISADOS = 10;

// Quién está logueado, para firmar cambios y no notificarse a sí mismo.
function actorActual() {
  const sesion = JSON.parse(localStorage.getItem("session") || "null") as { username?: string } | null;
  const uid = auth.currentUser?.uid;
  return uid && sesion?.username ? { id: uid, nombre: sesion.username } : null;
}

export const ticketsService = {
  // Crea el ticket y, en la misma transacción, avisa a los admins activos.
  // Máximo MAX_ADMINS_AVISADOS: cada aviso cuesta una lectura en las reglas
  // y una transacción tiene un tope de 20.
  create: async (data: Omit<Ticket, "id" | "order" | "code" | "createdAt" | "updatedAt">) => {
    const admins = (await adminsActivos()).filter((a) => a !== data.createdBy).slice(0, MAX_ADMINS_AVISADOS);
    return await runTransaction(db, async (transaction) => {
      const configRef = doc(db, "config", "app");
      const configDoc = await transaction.get(configRef);
      
      if (!configDoc.exists()) {
        throw new Error("Configuración de la aplicación no encontrada");
      }

      const configData = configDoc.data();
      const nextOrder = (configData.ticketCounter || 0) + 1;
      const series = configData.series || "TK01";
      const code = generateTicketCode(series, nextOrder);

      const ticketRef = doc(collection(db, "tickets"));
      const newTicket = {
        ...data,
        order: nextOrder,
        code,
        assignedAt: data.assignedTo ? serverTimestamp() : null,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      transaction.set(ticketRef, newTicket);
      transaction.update(configRef, { ticketCounter: nextOrder });
      agregarNotificaciones(transaction, admins, data.createdBy, {
        ticketId: ticketRef.id,
        ticketCode: code,
        mensaje: mensajeTicketNuevo(data.title),
      });

      return { id: ticketRef.id, ...newTicket };
    });
  },

  getById: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    const ticketDoc = await getDoc(ticketRef);
    if (!ticketDoc.exists()) throw new Error("Ticket no encontrado");
    return { id: ticketDoc.id, ...ticketDoc.data() } as Ticket;
  },

  // Tiempo real: la IA (u otro admin) puede modificar el ticket después de
  // creado (urgencia, asignación) — sin esto la UI se queda con los datos
  // viejos hasta que el usuario recarga la página a mano.
  //
  // Visibilidad (espejo de puedeVerTicket en firestore.rules): un admin ve
  // la colección entera; el resto, solo los que creó y los que tiene
  // asignados (2 listeners combinados). Firestore rechaza una query sin esos
  // filtros para un no-admin, aunque después se filtrara en el cliente.
  watch: (
    sesion: { userId: string; role: string; personalId?: string },
    cb: (tickets: Ticket[]) => void,
    soloPapelera = false,
    onError?: (error: Error) => void
  ) => {
    const ticketsRef = collection(db, "tickets");
    const queries = esAdmin(sesion.role)
      ? [query(ticketsRef, orderBy("order", "desc"))]
      : [
          query(ticketsRef, where("createdBy", "==", sesion.userId)),
          ...(sesion.personalId ? [query(ticketsRef, where("assignedTo", "==", sesion.personalId))] : []),
        ];

    const parciales: (Ticket[] | null)[] = queries.map(() => null);
    const emitir = () => {
      if (parciales.some((p) => p === null)) return; // esperar a que respondan todas
      const porId = new Map<string, Ticket>();
      for (const lista of parciales) for (const t of lista!) porId.set(t.id, t);
      cb(
        [...porId.values()]
          .filter((t) => (soloPapelera ? !!t.deletedAt : !t.deletedAt))
          .sort((a, b) => b.order - a.order)
      );
    };

    const unsubs = queries.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          parciales[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
          emitir();
        },
        (error) => onError?.(error)
      )
    );
    return () => unsubs.forEach((u) => u());
  },

  watchById: (id: string, cb: (ticket: Ticket | null) => void) => {
    const ticketRef = doc(db, "tickets", id);
    return onSnapshot(ticketRef, (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ticket) : null);
    });
  },

  // Actualiza el ticket y, en el mismo batch, escribe su historial (estado,
  // urgencia, categoría, asignación, solución) y notifica: al creador todo,
  // al técnico asignado solo su asignación.
  update: async (id: string, data: Partial<Ticket>) => {
    const ticketRef = doc(db, "tickets", id);
    // Firma del cambio, para que el historial muestre quién lo hizo
    // (las reglas exigen que id/nombre sean los de la sesión).
    const actor = actorActual();
    if (!actor) throw new Error("Sesión requerida. Vuelve a iniciar sesión.");
    const updateData: UpdateData<Ticket> = {
      ...data,
      modificadoPor: { tipo: "usuario", id: actor.id, nombre: actor.nombre, en: serverTimestamp() },
      updatedAt: serverTimestamp(),
    };

    if (data.status === "terminado") {
      updateData.finishedAt = serverTimestamp();
    } else if (data.status) {
      // Reabrir un ticket que ya había sido terminado: limpiar finishedAt,
      // si no queda con una fecha de "finalizado" vieja y falsa (rompe
      // cualquier métrica de tiempo de resolución que se calcule a futuro).
      updateData.finishedAt = null;
    }

    const antes = (await getDoc(ticketRef)).data() as Ticket | undefined;
    if (!antes) throw new Error("Ticket no encontrado");
    const despues = { ...antes, ...data };
    const nombre = await nombresDeEmpleados([antes.assignedTo, despues.assignedTo]);
    const cambios = cambiosDeTicket(antes, despues, nombre);
    const asignacion = cambios.find((c) => c.clave === "asignacion");
    const tecnicos = asignacion ? await usuariosDeEmpleado(despues.assignedTo) : [];
    const creador = antes.createdBy !== IA_CREATED_BY ? antes.createdBy : null;
    const firma = ` (por ${actor.nombre})`;

    const batch = writeBatch(db);
    batch.update(ticketRef, updateData);
    cambios.forEach((cambio, orden) => {
      agregarEvento(batch, id, { ...cambio, actorId: actor.id, actorNombre: actor.nombre, orden });
    });
    // Una sola notificación por destinatario (cada una cuesta lecturas en
    // las reglas, con un tope por batch): el creador recibe todos los
    // cambios juntos; el técnico, solo su asignación.
    const datos = { ticketId: id, ticketCode: antes.code };
    if (creador && cambios.length > 0) {
      agregarNotificaciones(batch, [creador], actor.id, {
        ...datos,
        mensaje: truncar(cambios.map((c) => c.mensaje).join(" · "), 480) + firma,
      });
    }
    if (asignacion) {
      agregarNotificaciones(batch, tecnicos.filter((t) => t !== creador), actor.id, {
        ...datos,
        mensaje: asignacion.mensaje + firma,
      });
    }
    await batch.commit();
  },

  delete: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    await updateDoc(ticketRef, {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  restaurar: async (id: string) => {
    const ticketRef = doc(db, "tickets", id);
    await updateDoc(ticketRef, { deletedAt: null, updatedAt: serverTimestamp() });
  },

  // Borra el ticket, su historial (eventos) y sus imágenes de Storage
  // (problema, solución y comentarios), que si no quedarían ocupando cuota
  // para siempre. Las reglas solo lo permiten a un admin y sobre un ticket
  // en la papelera. Lotes de 450 (tope de 500 por batch).
  eliminarDefinitivo: async (id: string) => {
    const ticket = (await getDoc(doc(db, "tickets", id))).data() as Ticket | undefined;
    const eventos = (await getDocs(collection(db, "tickets", id, "eventos"))).docs;
    const imagenes = [
      ...(ticket?.problemImages ?? []),
      ...(ticket?.solutionImages ?? []),
      ...eventos.flatMap((e) => (e.data().imagenes as string[] | undefined) ?? []),
    ];
    // Solo las de este ticket en nuestro bucket; una que ya no existe no frena el borrado.
    await Promise.all(
      imagenes.filter((url) => esImagenDeTicket(url, id)).map((url) => deleteObject(ref(storage, url)).catch(() => {}))
    );

    for (let i = 0; i < eventos.length; i += 450) {
      const batch = writeBatch(db);
      eventos.slice(i, i + 450).forEach((e) => batch.delete(e.ref));
      await batch.commit();
    }
    const batch = writeBatch(db);
    batch.delete(doc(db, "tickets", id));
    await batch.commit();
  },

  reanalizarIA: async (id: string) => {
    const fn = httpsCallable<{ ticketId: string }, { ok: boolean; motivo?: string }>(
      functions,
      "reanalizarTicketIA"
    );
    const { data } = await fn({ ticketId: id });
    return data;
  }
};
