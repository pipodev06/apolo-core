import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { NavTabs } from "../components/ui/tabs";
import { useAccess } from "../context/AccessContext";
import { useAuth } from "../context/AuthContext";
import { esAdmin } from "../lib/roles";

export const Papelera: React.FC = () => {
  const location = useLocation();
  const { hasAccess } = useAccess();
  const { user } = useAuth();

  const tabs = [
    // Restaurar/purgar tickets es de gestión (solo admins, ver firestore.rules).
    hasAccess("tickets") && esAdmin(user?.role) && { label: "Tickets", path: "/papelera/tickets" },
    hasAccess("personal") && { label: "Empleados", path: "/papelera/empleados" },
    hasAccess("personal") && { label: "Cargos", path: "/papelera/cargos" },
    hasAccess("personal") && { label: "Áreas", path: "/papelera/areas" },
    hasAccess("administracion") && { label: "Categorías", path: "/papelera/categorias" },
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
