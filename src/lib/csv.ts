// Descarga un CSV abrible en Excel: BOM UTF-8 (tildes/ñ correctas) y
// valores entre comillas.
export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]) {
  const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const contenido = [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
