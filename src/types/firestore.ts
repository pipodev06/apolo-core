import type { Timestamp } from "firebase/firestore";

// Campo de fecha proveniente de Firestore: llega como Timestamp al leer el
// documento del servidor, pero puede pasar por Date o string en checkpoints
// intermedios del cliente (formularios, datos optimistas, etc.).
export type FirestoreTimestamp = Timestamp | Date | string;
