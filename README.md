<div align="center">

# apolo-core

Sistema de tickets de soporte de TI con asignación automática por IA, para equipos que atienden incidencias internas. Cada empresa usa su propio proyecto de Firebase.

![React](https://img.shields.io/badge/React-19-087ea4)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Firebase](https://img.shields.io/badge/Firebase-Blaze-ffca28)
![Groq](https://img.shields.io/badge/IA-Groq-f55036)
![Licencia](https://img.shields.io/badge/licencia-MIT-2da44e)

[Demo](https://apolo-core.vercel.app) · [Funciones](#funciones) · [Instalación](#instalación) · [Configuración](#configuración) · [Despliegue](#despliegue)

</div>

## Funciones

| Tickets | Asignación con IA |
|---|---|
| Crear, asignar y cerrar · categorías y urgencia · SLA por urgencia · historial de cambios · exportación a CSV · papelera con restauración | Groq elige área, urgencia y categoría, y al técnico activo con menos carga · también funciona en modo manual |
| **Personas y accesos** | **Seguimiento** |
| Roles super admin, admin y usuario · matriz de accesos por sección · personal con cargos y áreas | Dashboard de métricas · histórico por empleado · notificaciones dentro de la app |

## Tecnologías

| Pieza | Tecnología |
|---|---|
| Interfaz | React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions v2) |
| IA | Groq |
| Hosting | Vercel (frontend) y Firebase (reglas y funciones) |

## Instalación

Necesitas Node 24 y pnpm (las Cloud Functions usan Node 22), Firebase CLI (`npm i -g firebase-tools` y `firebase login`), un proyecto de Firebase en plan **Blaze** (lo exigen las Cloud Functions; el uso normal entra en la capa gratuita) y una API key de [Groq](https://console.groq.com) (alcanza el plan gratis).

1. `git clone https://github.com/pipodev06/apolo-core.git && cd apolo-core`
2. En [la consola de Firebase](https://console.firebase.google.com), crea el proyecto y activa Firestore (modo producción), Storage y Authentication con **Correo electrónico/contraseña**. Agrega una app **Web** para obtener su `firebaseConfig`.
3. `cp .env.example .env` y completa las variables con ese `firebaseConfig` (ver [Configuración](#configuración)).
4. Apunta la CLI a tu proyecto: `firebase use --add` (reemplaza el id que trae `.firebaserc`).
5. Crea el secreto de la IA, aunque no la uses (el deploy lo pide): `firebase functions:secrets:set GROQ_API_KEY`
6. Despliega reglas, índices, Storage y funciones:
   ```bash
   (cd functions && npm install)
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
7. `pnpm install && pnpm dev` y abre http://localhost:5173
8. **Crea el primer usuario de inmediato:** en una instalación nueva, `/login` lleva a `/setup`, donde se crea el super admin. Las demás cuentas se crean en *Administración → Usuarios*.

## Configuración

| Variable | Para qué |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | `firebaseConfig` de la app web, de *Project Settings → Tus apps* (es público: la seguridad está en las reglas y las funciones) |
| `VITE_RECAPTCHA_SITE_KEY` | Opcional: activa App Check con reCAPTCHA v3 (site key pública) |
| `GROQ_API_KEY` | Secreto de Cloud Functions para la IA; no va en `.env` (`firebase functions:secrets:set GROQ_API_KEY`) |

**App Check (recomendado):** crea la clave reCAPTCHA v3 para tu dominio y `localhost`, regístrala en *Firebase → App Check* con TTL de 24 h y ponla en `VITE_RECAPTCHA_SITE_KEY`.

> [!WARNING]
> - Mientras no exista el super admin, cualquiera que entre a `/setup` podría crearlo: créalo apenas instales.
> - Activar **Enforce** de App Check antes de tiempo deja la app sin funcionar: actívalo solo cuando App Check muestre las peticiones como verificadas.
> - Borrar el secreto `GROQ_API_KEY` entero le quita el permiso y el siguiente deploy falla: para cambiar la key, vuelve a correr `secrets:set`.
> - Tras cambiar la key, las funciones siguen con la vieja hasta redesplegar `functions:asignarTicketIA,functions:reanalizarTicketIA`.

## Despliegue

- **Frontend:** importa el repo en Vercel y carga las variables `VITE_*` en *Project Settings → Environment Variables*. Build: `pnpm build` → `dist`.
- **Reglas y funciones:** `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`.

## Licencia

[MIT](LICENSE).
