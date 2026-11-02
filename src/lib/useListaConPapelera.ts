import { useCallback, useEffect, useState } from "react";
import { notificarError } from "./alertas";

// Lista de una pantalla con Papelera (Empleados, Cargos, Áreas, Categorías):
// - Activos: vienen de un listener compartido (CatalogosContext), sin leer
//   nada al entrar; se actualizan solos tras crear/editar/borrar.
// - Papelera: se pide al servidor al entrar y al pedir `recargar` (se usa poco
//   y no vale la pena tenerla escuchando toda la sesión).
export function useListaConPapelera<T>(
  soloPapelera: boolean,
  vivos: { lista: T[]; listo: boolean },
  cargarPapelera: () => Promise<T[]>
) {
  const [papelera, setPapelera] = useState<T[] | null>(null);

  const recargarPapelera = useCallback(async () => {
    try {
      setPapelera(await cargarPapelera());
    } catch {
      notificarError("Error al cargar la papelera");
      setPapelera([]);
    }
  }, [cargarPapelera]);

  useEffect(() => {
    if (soloPapelera) Promise.resolve().then(recargarPapelera);
  }, [soloPapelera, recargarPapelera]);

  return soloPapelera
    ? { items: papelera ?? [], loading: papelera === null, recargar: recargarPapelera }
    : { items: vivos.lista, loading: !vivos.listo, recargar: NADA };
}

// Los activos se refrescan solos (listener): recargar no hace nada.
const NADA = async () => {};
