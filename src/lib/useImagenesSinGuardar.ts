import { useEffect, useMemo, useRef } from "react";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

// Borra archivos de Storage por su URL. Best-effort: una imagen que ya no
// existe (o un fallo de red) no frena nada.
export function borrarImagenes(urls: Iterable<string>) {
  for (const url of urls) deleteObject(ref(storage, url)).catch(() => {});
}

export interface ImagenesSinGuardar {
  alSubir: (urls: string[]) => void;
  alQuitar: (url: string) => void;
  alGuardar: () => void;
}

// Las imágenes se suben a Storage apenas se eligen, antes de guardar el
// formulario. Este hook evita dos fugas:
//  • Formulario abandonado: al salir de la pantalla sin guardar, borra lo
//    que se subió en ella (si no, quedaría en Storage para siempre).
//  • Quitar una imagen ya guardada y después cancelar: no la borra hasta
//    guardar (si no, el ticket quedaría apuntando a un archivo inexistente).
// Llamar alGuardar() recién cuando el guardado salió bien.
export function useImagenesSinGuardar(): ImagenesSinGuardar {
  const subidas = useRef(new Set<string>()); // subidas acá, aún no guardadas
  const quitadas = useRef(new Set<string>()); // ya guardadas, quitadas acá

  useEffect(() => {
    const pendientes = subidas.current;
    return () => borrarImagenes(pendientes);
  }, []);

  return useMemo(
    () => ({
      alSubir: (urls) => urls.forEach((u) => subidas.current.add(u)),
      alQuitar: (url) => {
        if (subidas.current.delete(url)) borrarImagenes([url]);
        else quitadas.current.add(url);
      },
      alGuardar: () => {
        borrarImagenes(quitadas.current);
        quitadas.current.clear();
        subidas.current.clear();
      },
    }),
    []
  );
}
