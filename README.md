# apolo-core

Sistema de tickets de soporte de TI con asignación automática por IA, para equipos que atienden incidencias internas. Cada empresa usa su propio proyecto de Firebase.

## Qué hace
- Crea, asigna y cierra tickets con categorías, urgencia y SLA por urgencia.
- Asigna tickets solo con IA (Groq): elige área, urgencia y categoría, y al técnico activo con menos carga. También funciona en modo manual.
- Roles (super admin, admin, usuario) con matriz de accesos por sección, personal con cargos y áreas.
- Dashboard de métricas, histórico por empleado, historial de cambios de cada ticket y exportación a CSV.
- Notificaciones dentro de la app y papelera con restauración.

## Tecnologías
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts
- Backend: Firebase (Auth, Firestore, Storage, Cloud Functions v2) · IA: Groq
- Hosting: Vercel (frontend) y Firebase (reglas y funciones)

## Requisitos
- Node 24 y pnpm (las Cloud Functions usan Node 22)
- Firebase CLI: `npm i -g firebase-tools` y `firebase login`
- Un proyecto Firebase en plan **Blaze** (lo exigen las Cloud Functions; el uso normal entra en la capa gratuita)
- Una API key de [Groq](https://console.groq.com) (alcanza el plan gratis)

## Cómo levantarlo
1. `git clone https://github.com/pipodev06/apolo-core.git && cd apolo-core`
2. En [la consola de Firebase](https://console.firebase.google.com), crea el proyecto y activa Firestore (modo producción), Storage y Authentication con **Correo electrónico/contraseña**. Agrega una app **Web** para obtener su `firebaseConfig`.
3. `cp .env.example .env` y completa las variables con ese `firebaseConfig` (ver Configuración).
4. Apunta la CLI a tu proyecto: `firebase use --add` (reemplaza el id que trae `.firebaserc`).
5. Crea el secreto de la IA, aunque no la uses (el deploy lo pide): `firebase functions:secrets:set GROQ_API_KEY`
6. Despliega reglas, índices, Storage y funciones:
   ```bash
   (cd functions && npm install)
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
7. `pnpm install && pnpm dev` → abre en http://localhost:5173
8. **Crea el primer usuario de inmediato:** en una instalación nueva, `/login` lleva a `/setup`, donde se crea el super admin. Hasta que lo hagas, cualquiera que entre a `/setup` podría crearlo. Las demás cuentas se crean en *Administración → Usuarios*.

## Configuración
| Variable | Para qué | Ejemplo de formato |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | `firebaseConfig` de la app web (es público: la seguridad está en las reglas y las funciones) | valores de *Project Settings → Tus apps* |
| `VITE_RECAPTCHA_SITE_KEY` | Opcional: activa App Check con reCAPTCHA v3 | site key pública de reCAPTCHA v3 |
| `GROQ_API_KEY` | Secreto de Cloud Functions para la IA (no va en `.env`) | `firebase functions:secrets:set GROQ_API_KEY` |

**App Check (recomendado):** crea la clave reCAPTCHA v3 para tu dominio y `localhost`, regístrala en *Firebase → App Check* con TTL de 24 h y ponla en `VITE_RECAPTCHA_SITE_KEY`. Activa **Enforce** en Firestore y Storage solo cuando App Check muestre las peticiones como verificadas; si lo activas antes, la app deja de funcionar.

## Despliegue
- **Frontend:** importa el repo en Vercel y carga las variables `VITE_*` en *Project Settings → Environment Variables*. Build: `pnpm build` → `dist`.
- **Reglas y funciones:** `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`.
- **Cambiar la key de Groq:** `firebase functions:secrets:set GROQ_API_KEY` y vuelve a desplegar `functions:asignarTicketIA,functions:reanalizarTicketIA`. No borres el secreto entero: pierde su permiso y el siguiente deploy falla.

Sitio de ejemplo: https://apolo-core.vercel.app

## Licencia
[MIT](LICENSE).
