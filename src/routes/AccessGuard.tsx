import React from "react";
import { Navigate } from "react-router-dom";
import { useAccess } from "../context/AccessContext";
import type { AccessSections } from "../types/access";

interface AccessGuardProps {
  section: keyof AccessSections;
  children: React.ReactNode;
}

// Sin permiso: redirige a "/" sin aviso -- no confirmar que la ruta existe a
// quien no tiene acceso a ella (evita enumeración de rutas). Decisión
// explícita del usuario 2026-08-24.
export const AccessGuard: React.FC<AccessGuardProps> = ({ section, children }) => {
  const { hasAccess, isLoading } = useAccess();

  if (isLoading) return null;

  if (!hasAccess(section)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
