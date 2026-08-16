import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { NavTabs } from "../../components/ui/tabs";

const tabs = [
  { label: "Modo de Asignación", path: "/administracion/modo" },
  { label: "Usuarios", path: "/administracion/usuarios" },
  { label: "Matriz de Accesos", path: "/administracion/accesos" },
];

export const Administracion: React.FC = () => {
  const location = useLocation();

  if (location.pathname === "/administracion") {
    return <Navigate to="/administracion/modo" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Administración</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <NavTabs tabs={tabs} />
        <div className="mt-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
