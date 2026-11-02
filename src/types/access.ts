import type { FirestoreTimestamp } from "./firestore";

export interface AccessSections {
  dashboard: boolean;
  tickets: boolean;
  personal: boolean;
  administracion: boolean;
  notificaciones: boolean;
  papelera: boolean;
  historico: boolean;
  // No es una sección: permiso de adjuntar imágenes (ticket, solución y
  // comentarios). Es el único que también aplica a admins (lo gestiona el
  // super_admin); el super_admin siempre puede.
  subirImagenes: boolean;
}

export interface UserAccess {
  userId: string;
  sections: AccessSections;
  updatedAt: FirestoreTimestamp;
}
