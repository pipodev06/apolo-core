import React, { createContext, useContext, useState, useEffect } from "react";
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

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessSections | null>(null);
  // Id del usuario para el que `access` ya quedó resuelto. Justo después de un
  // login, `user` cambia en el render pero el efecto de abajo (que recalcula
  // `access`) todavía no corrió — si `isLoading` fuera un state aparte, quedaría
  // en `false` (heredado del usuario anterior/deslogueado) por un ciclo de render,
  // y AccessGuard denegaría con `access` todavía en null. Derivar `isLoading`
  // comparando ids evita esa ventana: cambia en el MISMO render que `user`.
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  const isLoading = !!user && loadedForUserId !== user.userId;

  useEffect(() => {
    if (!user) {
      setAccess(null);
      setLoadedForUserId(null);
      return;
    }

    // Roles elevados (admin / super_admin): acceso total siempre.
    if (esAdmin(user.role)) {
      setAccess({
        dashboard: true,
        tickets: true,
        personal: true,
        administracion: true,
        notificaciones: true,
        papelera: true,
        historico: true,
      });
      setLoadedForUserId(user.userId);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "access", user.userId),
      (doc) => {
        if (doc.exists()) {
          const sections = doc.data().sections || {};
          setAccess({
            dashboard: !!sections.dashboard,
            tickets: !!sections.tickets,
            personal: !!sections.personal,
            administracion: !!sections.administracion,
            // Campos nuevos: los documentos de acceso existentes todavía no
            // los tienen — por defecto siguen activos (como ya estaba antes
            // de que existiera el permiso) salvo que se desactiven explícito.
            notificaciones: sections.notificaciones !== false,
            papelera: sections.papelera !== false,
            // historico es opt-in (como personal/administracion): docs
            // viejos sin el campo quedan sin acceso hasta que un admin lo
            // habilite explícito en la Matriz de Accesos.
            historico: !!sections.historico,
          });
        } else {
          setAccess({
            dashboard: false,
            tickets: true, // Default access
            personal: false,
            administracion: false,
            notificaciones: true, // Default access
            papelera: true, // Default access
            historico: false,
          });
        }
        setLoadedForUserId(user.userId);
      },
      () => {
        // Si falla la lectura, no dejamos la app colgada en "cargando".
        setAccess({
          dashboard: false,
          tickets: true,
          personal: false,
          administracion: false,
          notificaciones: true,
          papelera: true,
          historico: false,
        });
        setLoadedForUserId(user.userId);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const hasAccess = (section: keyof AccessSections) => {
    if (esAdmin(user?.role)) return true;
    return access ? access[section] : false;
  };

  return (
    <AccessContext.Provider value={{ access, isLoading, hasAccess }}>
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
