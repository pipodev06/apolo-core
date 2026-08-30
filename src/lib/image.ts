// Recomprime una imagen a WebP en el cliente antes de subirla a Storage —
// baja bastante el peso (ancho de banda + costo) sin depender de una
// librería externa. Si el navegador no soporta canvas/createImageBitmap,
// devuelve el archivo original tal cual (nunca bloquea la subida).
export async function compressToWebp(file: File, maxDimension = 1600, quality = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) return file;

    const nombreBase = file.name.replace(/\.[^./]+$/, "");
    return new File([blob], `${nombreBase}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
