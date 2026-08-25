export type Role = "super_admin" | "admin" | "usuario";

// admin y super_admin son roles "elevados" (acceso total).
export const esAdmin = (role?: string): boolean => role === "admin" || role === "super_admin";

export const esSuperAdmin = (role?: string): boolean => role === "super_admin";

export const roleLabel = (role?: string): string =>
  role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Usuario";
