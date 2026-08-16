import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export interface AppConfig {
  assignmentMode: "ia" | "manual";
  ticketCounter: number;
  series: string;
  // Techo de carga (tickets abiertos) por empleado — ausente en docs viejos,
  // creados antes de este campo.
  maxTicketsAbiertos?: number;
}

export const configService = {
  getAppConfig: async () => {
    const configRef = doc(db, "config", "app");
    const configDoc = await getDoc(configRef);
    if (!configDoc.exists()) throw new Error("Configuración no encontrada");
    return configDoc.data() as AppConfig;
  },

  updateAssignmentMode: async (mode: "ia" | "manual") => {
    const configRef = doc(db, "config", "app");
    await updateDoc(configRef, {
      assignmentMode: mode,
      updatedAt: serverTimestamp(),
    });
  },

  updateMaxTicketsAbiertos: async (max: number) => {
    const configRef = doc(db, "config", "app");
    await updateDoc(configRef, {
      maxTicketsAbiertos: max,
      updatedAt: serverTimestamp(),
    });
  },
};
