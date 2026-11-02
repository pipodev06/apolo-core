import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { AccessSections } from "../types/access";

export const accessService = {
  updateAccess: async (userId: string, sections: AccessSections) => {
    const accessRef = doc(db, "access", userId);
    // setDoc + merge: actualiza si existe y crea si faltara (nunca falla por doc inexistente).
    await setDoc(accessRef, { userId, sections, updatedAt: serverTimestamp() }, { merge: true });
  }
};
