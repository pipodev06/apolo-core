import { useTheme } from "../context/ThemeContext";

// Los gráficos de Recharts se pintan en SVG con props/estilos inline, no
// clases de Tailwind: no responden a `dark:`, el color se resuelve a mano.
export function useColoresGrafico() {
  const { theme } = useTheme();
  const oscuro = theme === "dark";
  const gridColor = oscuro ? "#334155" : "#e2e8f0";
  return {
    axisColor: oscuro ? "#94a3b8" : "#64748b",
    gridColor,
    tooltipStyle: {
      backgroundColor: oscuro ? "#111827" : "#ffffff",
      border: `1px solid ${gridColor}`,
      borderRadius: "0.5rem",
      color: oscuro ? "#f1f5f9" : "#0f172a",
      fontSize: "0.875rem",
    },
  };
}
