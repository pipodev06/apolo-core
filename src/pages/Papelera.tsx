import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PaginaConPestanas } from "../components/layout/PaginaConPestanas";
import { useAccess } from "../context/AccessContext";
import { useAuth } from "../context/AuthContext";
import { tabsPapelera } from "../lib/papelera";

export const Papelera: React.FC = () => {
  const location = useLocation();
  const { hasAccess } = useAccess();
  const { user } = useAuth();

  const tabs = tabsPapelera(hasAccess, user?.role);

  if (tabs.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (location.pathname === "/papelera") {
    return <Navigate to={tabs[0].path} replace />;
  }

  return <PaginaConPestanas titulo="Papelera" tabs={tabs} />;
};
