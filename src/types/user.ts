export type { Role } from "../lib/roles";
import type { Role } from "../lib/roles";
import type { FirestoreTimestamp } from "./firestore";

export interface User {
  id: string;
  username: string;
  usernameHash: string;
  passwordHash: string;
  email?: string;
  role: Role;
  active: boolean;
  deletedAt?: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
