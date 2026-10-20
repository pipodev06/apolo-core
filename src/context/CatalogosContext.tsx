import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import type { Empleado } from "../types/empleado";
import type { Catalogo } from "../types/catalogo";

interface CatalogosContextType {
  // Personal y categorías sin los que están en la papelera (incluye inactivos:
  // cada pantalla filtra por `activo` si lo necesita).
  empleados: Empleado[];
  categorias: Catalogo[];
  empleadosListos: boolean;
  categoriasListas: boolean;
}

const CatalogosContext = createContext<CatalogosContextType | undefined>(undefined);

interface Cargado<T> {
  userId: string;
  lista: T[];
}

// Un listener por catálogo para toda la sesión, igual que TicketsProvider:
// antes Dashboard, Tickets, Detalle, Formulario, Histórico y los modales de
// usuario descargaban cada uno la colección `personal` completa al montarse.
// Con onSnapshot además se actualizan solos cuando un admin cambia algo.
export const CatalogosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [empleados, setEmpleados] = useState<Cargado<Empleado> | null>(null);
  const [categorias, setCategorias] = useState<Cargado<Catalogo> | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.userId;
    const vacio = <T,>(prev: Cargado<T> | null) => (prev?.userId === userId ? prev : { userId, lista: [] as T[] });

    const unsubEmpleados = onSnapshot(
      query(collection(db, "personal"), orderBy("nombre", "asc")),
      (snap) =>
        setEmpleados({
          userId,
          lista: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Empleado)).filter((e) => !e.deletedAt),
        }),
      () => setEmpleados(vacio)
    );
    const unsubCategorias = onSnapshot(
      query(collection(db, "categorias"), orderBy("nombre", "asc")),
      (snap) =>
        setCategorias({
          userId,
          lista: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Catalogo)).filter((c) => !c.deletedAt),
        }),
      () => setCategorias(vacio)
    );
    return () => {
      unsubEmpleados();
      unsubCategorias();
    };
  }, [user]);

  const value = useMemo(() => {
    const empleadosOk = !!user && empleados?.userId === user.userId;
    const categoriasOk = !!user && categorias?.userId === user.userId;
    return {
      empleados: empleadosOk ? empleados.lista : [],
      categorias: categoriasOk ? categorias.lista : [],
      empleadosListos: empleadosOk,
      categoriasListas: categoriasOk,
    };
  }, [user, empleados, categorias]);

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
};

export const useCatalogos = () => {
  const ctx = useContext(CatalogosContext);
  if (!ctx) throw new Error("useCatalogos debe usarse dentro de CatalogosProvider");
  return ctx;
};
