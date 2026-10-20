import type { AccessSections } from "../types/access";
import { esAdmin } from "./roles";

export interface TabPapelera {
  label: string;
  path: string;
}

// Pestañas de la Papelera que puede ver una cuenta. La usan la página de
// Papelera y el Sidebar: si no hay ninguna, el ítem no se muestra en el menú
// (antes aparecía y al entrar redirigía al inicio sin explicación).
export function tabsPapelera(
  hasAccess: (section: keyof AccessSections) => boolean,
  role?: string
): TabPapelera[] {
  if (!hasAccess("papelera")) return [];
  const tabs: (TabPapelera | false)[] = [
    // Restaurar/purgar tickets es de gestión (solo admins, ver firestore.rules).
    hasAccess("tickets") && esAdmin(role) && { label: "Tickets", path: "/papelera/tickets" },
    hasAccess("personal") && { label: "Empleados", path: "/papelera/empleados" },
    hasAccess("personal") && { label: "Cargos", path: "/papelera/cargos" },
    hasAccess("personal") && { label: "Áreas", path: "/papelera/areas" },
    hasAccess("administracion") && { label: "Categorías", path: "/papelera/categorias" },
    hasAccess("administracion") && { label: "Usuarios", path: "/papelera/usuarios" },
  ];
  return tabs.filter((t): t is TabPapelera => !!t);
}
