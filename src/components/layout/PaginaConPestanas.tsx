import React from "react";
import { Outlet } from "react-router-dom";
import { NavTabs } from "../ui/tabs";

// Página con título y una tarjeta con pestañas de navegación; cada pestaña
// es una ruta hija (Outlet). Administración y Papelera.
export const PaginaConPestanas: React.FC<{ titulo: string; tabs: { label: string; path: string }[] }> = ({
  titulo,
  tabs,
}) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
    </div>

    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <NavTabs tabs={tabs} />
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  </div>
);
