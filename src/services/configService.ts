import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const configService = {
  getAppConfig: async () => {
    const configRef = doc(db, "config", "app");
    const configDoc = await getDoc(configRef);
    if (!configDoc.exists()) throw new Error("Configuración no encontrada");
    return configDoc.data();
  },

  updateAssignmentMode: async (mode: "ia" | "manual") => {
    const configRef = doc(db, "config", "app");
    await updateDoc(configRef, {
      assignmentMode: mode,
      updatedAt: serverTimestamp(),
    });
  }
};
