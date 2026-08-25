import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { UserAccess, AccessSections } from "../types/access";

export const accessService = {
  getAll: async () => {
    const accessRef = collection(db, "access");
    const querySnapshot = await getDocs(accessRef);
    return querySnapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserAccess));
  },

  updateAccess: async (userId: string, sections: AccessSections) => {
    const accessRef = doc(db, "access", userId);
    // setDoc + merge: actualiza si existe y crea si faltara (nunca falla por doc inexistente).
    await setDoc(accessRef, { userId, sections, updatedAt: serverTimestamp() }, { merge: true });
  }
};
