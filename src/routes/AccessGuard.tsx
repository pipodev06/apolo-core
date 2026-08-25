import React from "react";
import { Navigate } from "react-router-dom";
import { useAccess } from "../context/AccessContext";
import type { AccessSections } from "../types/access";
import { notificarError } from "../lib/alertas";

interface AccessGuardProps {
  section: keyof AccessSections;
  children: React.ReactNode;
}

export const AccessGuard: React.FC<AccessGuardProps> = ({ section, children }) => {
  const { hasAccess, isLoading } = useAccess();

  if (isLoading) return null;

  if (!hasAccess(section)) {
    notificarError("No tienes permiso para acceder a esta sección.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
