import type { FirestoreTimestamp } from "./firestore";

export interface AccessSections {
  dashboard: boolean;
  tickets: boolean;
  personal: boolean;
  administracion: boolean;
  notificaciones: boolean;
  papelera: boolean;
}

export interface UserAccess {
  userId: string;
  sections: AccessSections;
  updatedAt: FirestoreTimestamp;
}
