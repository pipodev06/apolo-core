import React from "react";
import { Link, useLocation } from "react-router-dom";
import { IconHome as Home, IconLayoutDashboard as LayoutDashboard, IconTicket as Ticket, IconUsers as Users, IconSettings as Settings, IconLogout as LogOut, IconTrash as Trash2, type Icon as LucideIcon } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { useAccess } from "../../context/AccessContext";
import { cn } from "../../lib/cn";
import type { AccessSections } from "../../types/access";

const navItems: { icon: LucideIcon; label: string; path: string; section?: keyof AccessSections }[] = [
  { icon: Home, label: "Inicio", path: "/" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", section: "dashboard" },
  { icon: Ticket, label: "Tickets", path: "/tickets", section: "tickets" },
  { icon: Users, label: "Personal", path: "/personal", section: "personal" },
  { icon: Settings, label: "Administración", path: "/administracion", section: "administracion" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const { hasAccess } = useAccess();

  const papeleraVisible = hasAccess("papelera");
  const papeleraActiva = location.pathname.startsWith("/papelera");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:relative lg:translate-x-0",
        !isOpen && "-translate-x-full"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6 dark:border-gray-800">
          <div className="flex w-full items-center justify-center gap-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Ticket className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">Apolo Core</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            if (item.section && !hasAccess(item.section)) return null;

            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-600"
                    : "text-gray-800 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                )}
              >
                <item.icon
                  className={cn("mr-3 h-5 w-5", isActive ? "text-indigo-600" : "text-gray-800 dark:text-gray-100")}
                />
                {item.label}
              </Link>
            );
          })}

          {papeleraVisible && (
            <Link
              to="/papelera"
              onClick={onClose}
              className={cn(
                "flex items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                papeleraActiva
                  ? "bg-indigo-600/10 text-indigo-600"
                  : "text-gray-800 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              )}
            >
              <Trash2 className={cn("mr-3 h-5 w-5", papeleraActiva ? "text-indigo-600" : "text-gray-800 dark:text-gray-100")} />
              Papelera
            </Link>
          )}
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <button
            onClick={logout}
            className="flex w-full cursor-pointer items-center rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-600/10"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </aside>
  );
};
