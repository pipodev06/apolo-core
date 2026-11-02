import { setGlobalOptions } from "firebase-functions/v2";

// Opciones de todas las funciones (se importa primero en index.ts):
// - maxInstances: si alguien abusa (spam de tickets o de llamadas), el gasto
//   queda acotado en vez de escalar hasta 100 instancias.
// - cpu "gcf_gen1": CPU fraccionada según la memoria (~1/6 de vCPU con 256 MB)
//   en vez de 1 vCPU completa. Las funciones pasan casi todo el tiempo
//   esperando a Groq o a Firestore, así que cada segundo cuesta ~6 veces menos.
//   Con CPU < 1, cada instancia atiende una petición a la vez.
// - timeoutSeconds: corta una ejecución colgada a los 30 s (default 60 s).
setGlobalOptions({ maxInstances: 10, cpu: "gcf_gen1", timeoutSeconds: 30 });
