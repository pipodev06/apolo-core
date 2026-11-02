import { z } from "zod";

// zod no intenta compilar validadores con Function() (eval): la CSP no
// permite 'unsafe-eval'. Con los formularios chicos de la app no se nota.
// Se importa PRIMERO en main.tsx: zod lo lee al crear cada esquema, y los
// esquemas se crean al cargar los módulos (antes del cuerpo de main.tsx).
z.config({ jitless: true });
