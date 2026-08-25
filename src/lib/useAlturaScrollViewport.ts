import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const MARGEN_BOTTOM_DEFAULT = 15;
const ALTURA_MINIMA_PX = 200;

// Mide la posición top del contenedor en el viewport y calcula su maxHeight
// para que termine ~margenBottom px antes del borde inferior. Así SOLO ese
// contenedor scrollea internamente y la página queda estática.
export function useAlturaScrollViewport(
  margenBottom = MARGEN_BOTTOM_DEFAULT,
  deps: unknown[] = []
): {
  ref: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    overflowY: "auto",
    minHeight: `${ALTURA_MINIMA_PX}px`,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recalcular = () => {
      const top = el.getBoundingClientRect().top;
      const disponible = window.innerHeight - top - margenBottom;
      const altura = Math.max(disponible, ALTURA_MINIMA_PX);
      setStyle({
        maxHeight: `${altura}px`,
        overflowY: "auto",
        minHeight: `${Math.min(ALTURA_MINIMA_PX, altura)}px`,
      });
    };
    recalcular();
    const ro = new ResizeObserver(recalcular);
    ro.observe(document.body);
    window.addEventListener("resize", recalcular);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalcular);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenBottom, ...deps]);

  return { ref, style };
}
