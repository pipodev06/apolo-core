import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PaginaConPestanas } from "../../components/layout/PaginaConPestanas";

const tabs = [
  { label: "Configuración", path: "/administracion/modo" },
  { label: "Usuarios", path: "/administracion/usuarios" },
  { label: "Categorías", path: "/administracion/categorias" },
  { label: "Matriz de Accesos", path: "/administracion/accesos" },
];

export const Administracion: React.FC = () => {
  const location = useLocation();

  if (location.pathname === "/administracion") {
    return <Navigate to="/administracion/modo" replace />;
  }

  return <PaginaConPestanas titulo="Administración" tabs={tabs} />;
};
