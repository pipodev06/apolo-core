import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { NavTabs } from "../components/ui/tabs";
import { useAccess } from "../context/AccessContext";

export const Papelera: React.FC = () => {
  const location = useLocation();
  const { hasAccess } = useAccess();

  const tabs = [
    hasAccess("tickets") && { label: "Tickets", path: "/papelera/tickets" },
    hasAccess("personal") && { label: "Empleados", path: "/papelera/empleados" },
    hasAccess("personal") && { label: "Cargos", path: "/papelera/cargos" },
    hasAccess("personal") && { label: "Áreas", path: "/papelera/areas" },
    hasAccess("administracion") && { label: "Usuarios", path: "/papelera/usuarios" },
  ].filter((t): t is { label: string; path: string } => !!t);

  if (tabs.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (location.pathname === "/papelera") {
    return <Navigate to={tabs[0].path} replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Papelera</h1>
        <p className="text-muted-foreground">Elementos eliminados de todos los módulos, en un solo lugar.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <NavTabs tabs={tabs} />
        <div className="mt-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
