import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import type { AccessSections } from "../types/access";
import { esAdmin } from "../lib/roles";

interface AccessContextType {
  access: AccessSections | null;
  isLoading: boolean;
  hasAccess: (section: keyof AccessSections) => boolean;
}

const ACCESO_TOTAL: AccessSections = {
  dashboard: true,
  tickets: true,
  personal: true,
  administracion: true,
  notificaciones: true,
  papelera: true,
  historico: true,
};

// Sin documento de accesos o si falla la lectura: lo mínimo para usar la app.
const ACCESO_BASICO: AccessSections = {
  dashboard: false,
  tickets: true,
  personal: false,
  administracion: false,
  notificaciones: true,
  papelera: false,
  historico: false,
};

const AccessContext = createContext<AccessContextType | undefined>(undefined);

// Última matriz conocida de cada usuario, en localStorage: al recargar o
// volver a entrar, las pantallas protegidas se pintan al instante con ella
// en vez de quedar en blanco hasta que responde Firestore. El listener de
// abajo la corrige enseguida si un admin la cambió. Solo es para pintar la
// UI: lo que cada uno puede leer o escribir lo deciden las reglas.
const claveCache = (userId: string) => `access:${userId}`;

function leerCache(userId: string): AccessSections | null {
  try {
    const raw = localStorage.getItem(claveCache(userId));
    return raw ? { ...ACCESO_BASICO, ...(JSON.parse(raw) as Partial<AccessSections>) } : null;
  } catch {
    return null;
  }
}

function guardarCache(userId: string, access: AccessSections) {
  try {
    localStorage.setItem(claveCache(userId), JSON.stringify(access));
  } catch {
    // Sin localStorage (modo privado, cuota): solo se pierde la caché.
  }
}

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // Matriz etiquetada con el usuario al que pertenece: tras un logout/login
  // con otra cuenta no se usa (ni un render) la del anterior.
  const [cargado, setCargado] = useState<{ userId: string; access: AccessSections } | null>(null);

  // Roles elevados (admin / super_admin): acceso total siempre, derivado en
  // el render (sin efecto ni lectura de Firestore).
  const userEsAdmin = esAdmin(user?.role);

  useEffect(() => {
    if (!user || esAdmin(user.role)) return;
    const userId = user.userId;

    const unsubscribe = onSnapshot(
      doc(db, "access", userId),
      (snap) => {
        let access = ACCESO_BASICO;
        if (snap.exists()) {
          const sections = snap.data().sections || {};
          access = {
            dashboard: !!sections.dashboard,
            tickets: !!sections.tickets,
            personal: !!sections.personal,
            administracion: !!sections.administracion,
            // Docs viejos sin el campo: notificaciones sigue activo por
            // defecto (como antes de que existiera el permiso).
            notificaciones: sections.notificaciones !== false,
            papelera: !!sections.papelera,
            historico: !!sections.historico,
          };
        }
        guardarCache(userId, access);
        setCargado({ userId, access });
      },
      // Si falla la lectura, no dejamos la app colgada en "cargando".
      () => setCargado((prev) => (prev?.userId === userId ? prev : { userId, access: ACCESO_BASICO }))
    );

    return () => unsubscribe();
  }, [user]);

  // Mientras no llega la lectura de Firestore se usa la caché; solo si no
  // hay ninguna (primer ingreso en este navegador) se espera.
  const userId = user?.userId;
  const cache = useMemo(() => (userId && !userEsAdmin ? leerCache(userId) : null), [userId, userEsAdmin]);
  const accessUsuario =
    !userId || userEsAdmin ? null : cargado?.userId === userId ? cargado.access : cache;
  const isLoading = !!user && !userEsAdmin && !accessUsuario;
  const access = accessUsuario;

  const value = useMemo(() => {
    const accesoActual = !user ? null : userEsAdmin ? ACCESO_TOTAL : access;
    return {
      access: accesoActual,
      isLoading,
      hasAccess: (section: keyof AccessSections) => (accesoActual ? accesoActual[section] : false),
    };
  }, [user, userEsAdmin, access, isLoading]);

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error("useAccess must be used within an AccessProvider");
  }
  return context;
};
