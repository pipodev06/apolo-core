import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useAccess } from "./AccessContext";
import type { Empleado } from "../types/empleado";
import type { Catalogo } from "../types/catalogo";

interface CatalogosContextType {
  // Sin los que están en la papelera (incluye inactivos: cada pantalla
  // filtra por `activo` si lo necesita).
  empleados: Empleado[];
  categorias: Catalogo[];
  // Solo se cargan si la cuenta tiene acceso a Personal o Administración
  // (para el resto quedan vacíos y no se leen).
  areas: Catalogo[];
  cargos: Catalogo[];
  empleadosListos: boolean;
  categoriasListas: boolean;
  areasListas: boolean;
  cargosListos: boolean;
}

const CatalogosContext = createContext<CatalogosContextType | undefined>(undefined);

// Un listener por colección (ordenada por nombre, sin papelera) mientras
// `activo` sea true. La lista queda etiquetada con el usuario para el que se
// cargó: tras un logout/login con otra cuenta no se muestra la del anterior.
function useColeccion<T extends { deletedAt?: unknown }>(coleccion: string, userId: string | undefined, activo: boolean) {
  const [cargada, setCargada] = useState<{ userId: string; lista: T[] } | null>(null);

  useEffect(() => {
    if (!userId || !activo) return;
    return onSnapshot(
      query(collection(db, coleccion), orderBy("nombre", "asc")),
      (snap) =>
        setCargada({
          userId,
          lista: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T).filter((x) => !x.deletedAt),
        }),
      // Sin permiso o sin red: lista vacía en vez de quedar "cargando" para siempre.
      () => setCargada((prev) => (prev?.userId === userId ? prev : { userId, lista: [] }))
    );
  }, [coleccion, userId, activo]);

  const lista = cargada && cargada.userId === userId ? cargada.lista : null;
  return useMemo(() => ({ lista: lista ?? (VACIA as T[]), listo: !!lista }), [lista]);
}

// Misma referencia siempre que no hay datos: evita re-renders de quien la usa.
const VACIA: never[] = [];

// Catálogos compartidos por toda la sesión, igual que TicketsProvider: antes
// cada pantalla (Empleados, Cargos, Áreas, Categorías, el modal de empleado,
// Dashboard, Tickets…) descargaba su colección completa al montarse, en cada
// visita. Con onSnapshot se lee una vez y se actualizan solos cuando un admin
// cambia algo (cada cambio cuesta 1 lectura por sesión abierta: son
// colecciones que cambian poco). Áreas y cargos solo hacen falta en Personal
// y Administración, así que el resto de cuentas no los lee.
export const CatalogosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { hasAccess } = useAccess();
  const userId = user?.userId;
  const usaCatalogosDePersonal = hasAccess("personal") || hasAccess("administracion");

  const empleados = useColeccion<Empleado>("personal", userId, true);
  const categorias = useColeccion<Catalogo>("categorias", userId, true);
  const areas = useColeccion<Catalogo>("areas", userId, usaCatalogosDePersonal);
  const cargos = useColeccion<Catalogo>("cargos", userId, usaCatalogosDePersonal);

  const value = useMemo(
    () => ({
      empleados: empleados.lista,
      categorias: categorias.lista,
      areas: areas.lista,
      cargos: cargos.lista,
      empleadosListos: empleados.listo,
      categoriasListas: categorias.listo,
      areasListas: areas.listo,
      cargosListos: cargos.listo,
    }),
    [empleados, categorias, areas, cargos]
  );

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
};

export const useCatalogos = () => {
  const ctx = useContext(CatalogosContext);
  if (!ctx) throw new Error("useCatalogos debe usarse dentro de CatalogosProvider");
  return ctx;
};
