import { useMemo, useState } from "react";

// Paginación en el cliente para las tablas (con SimplePagination). Vuelve a
// la página 1 cuando cambia `reinicio` (ej. los filtros aplicados): se ajusta
// durante el render (patrón de React para "resetear estado cuando cambia una
// dependencia"), no en un efecto, así no hay un render extra.
export function usePaginacion<T>(items: T[], tamano: number, reinicio: string) {
  const [page, setPage] = useState(1);
  const [reinicioPrevio, setReinicioPrevio] = useState(reinicio);
  if (reinicio !== reinicioPrevio) {
    setReinicioPrevio(reinicio);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / tamano));
  const pagina = Math.min(page, totalPages);
  const paginados = useMemo(() => items.slice((pagina - 1) * tamano, pagina * tamano), [items, pagina, tamano]);
  // Número de fila (columna "#") del i-ésimo elemento de la página.
  const numero = (i: number) => (pagina - 1) * tamano + i + 1;

  return { pagina, totalPages, paginados, numero, setPage };
}
