import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authService } from "../services/authService";

export const SetupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inicializada, setInicializada] = useState<boolean | null>(null);

  useEffect(() => {
    // Si falla la lectura (offline, etc.) no dejamos /setup accesible por
    // error: se asume que ya está inicializada, igual que en Login.tsx.
    authService.appEstaInicializada().then(setInicializada).catch(() => setInicializada(true));
  }, []);

  if (inicializada === null) return null; // Loading state

  if (inicializada) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
