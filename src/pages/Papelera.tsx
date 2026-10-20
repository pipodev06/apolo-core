import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { NavTabs } from "../components/ui/tabs";
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
