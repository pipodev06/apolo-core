// Descarga un CSV abrible en Excel: BOM UTF-8 (tildes/ñ correctas) y
// valores entre comillas. Un texto que empieza con = + - @ (o tab/CR) se
// antepone con ' para que Excel no lo ejecute como fórmula: un título de
// ticket como =HYPERLINK(...) no debe correr en la PC del admin que exporta.
export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]) {
  const sinFormula = (v: string | number) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v));
  const celda = (v: string | number) => `"${sinFormula(v).replace(/"/g, '""')}"`;
  const contenido = [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
