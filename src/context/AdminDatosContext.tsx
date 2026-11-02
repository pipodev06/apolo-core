import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import type { User } from "../types/user";
import type { UserAccess } from "../types/access";

interface AdminDatosContextType {
  // Cuentas fuera de la papelera, más recientes primero.
  users: User[];
  access: UserAccess[];
  listo: boolean;
}

const AdminDatosContext = createContext<AdminDatosContextType | null>(null);

// Cuentas y matriz de accesos para las pestañas de Administración. Se monta
// en Administracion.tsx: los listeners viven solo mientras se está en esa
// sección (no toda la sesión ni para todas las cuentas), y cambiar entre
// Usuarios y Accesos ya no vuelve a descargar las dos colecciones.
export const AdminDatosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[] | null>(null);
  const [access, setAccess] = useState<UserAccess[] | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User).filter((u) => !u.deletedAt)),
      () => setUsers([])
    );
    const unsubAccess = onSnapshot(
      collection(db, "access"),
      (snap) => setAccess(snap.docs.map((d) => ({ userId: d.id, ...d.data() }) as UserAccess)),
      () => setAccess([])
    );
    return () => {
      unsubUsers();
      unsubAccess();
    };
  }, []);

  const value = useMemo(
    () => ({ users: users ?? [], access: access ?? [], listo: users !== null && access !== null }),
    [users, access]
  );
  return <AdminDatosContext.Provider value={value}>{children}</AdminDatosContext.Provider>;
};

// null fuera de Administración (ej. Usuarios en la Papelera, que lee aparte).
export const useAdminDatos = () => useContext(AdminDatosContext);
