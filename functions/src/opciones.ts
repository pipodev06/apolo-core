import { setGlobalOptions } from "firebase-functions/v2";

// Tope de instancias por función: si alguien abusa (spam de tickets o de
// llamadas), el gasto queda acotado en vez de escalar hasta 100 instancias.
// Se importa primero en index.ts para que aplique a todas las funciones.
setGlobalOptions({ maxInstances: 10 });
