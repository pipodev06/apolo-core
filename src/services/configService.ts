import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { SlaHoras } from "../lib/sla";

export interface AppConfig {
  assignmentMode: "ia" | "manual";
  ticketCounter: number;
  series: string;
  // Techo de carga (tickets abiertos) por empleado — ausente en docs viejos,
  // creados antes de este campo.
  maxTicketsAbiertos?: number;
  // Horas de SLA por urgencia (ausente = SLA_DEFAULT de lib/sla.ts).
  slaHoras?: SlaHoras;
  // Encola correos en `mail` (extensión Trigger Email) al notificar.
  emailHabilitado?: boolean;
}

export const configService = {
  getAppConfig: async () => {
    const configRef = doc(db, "config", "app");
    const configDoc = await getDoc(configRef);
    if (!configDoc.exists()) throw new Error("Configuración no encontrada");
    return configDoc.data() as AppConfig;
  },

  update: async (
    data: Pick<AppConfig, "assignmentMode" | "maxTicketsAbiertos" | "slaHoras" | "emailHabilitado">
  ) => {
    const configRef = doc(db, "config", "app");
    await updateDoc(configRef, { ...data, updatedAt: serverTimestamp() });
  },
};
