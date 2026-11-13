# apolo-core

**apolo-core** es un sistema de tickets de soporte de TI con asignación automática por IA, para equipos que atienden incidencias internas. Cada empresa usa su propio proyecto de Firebase. Software libre bajo [MIT](LICENSE).

> 🚀 **En 3 pasos:** crea el proyecto de Firebase → despliega reglas y funciones → `pnpm install && pnpm dev` y abre http://localhost:5173 (detalle en [Cómo levantarlo](#-cómo-levantarlo)).

```
Ticket nuevo ─▶ Cloud Function ─▶ IA (Groq) elige área, urgencia y categoría
             ─▶ técnico activo con menos carga ─▶ notificación en la app
```

## ✨ Qué hace

- 🎫 **Tickets completos:** crea, asigna y cierra tickets con categorías, urgencia y SLA por urgencia.
- 🤖 **Asignación con IA (Groq):** elige área, urgencia y categoría, y al técnico activo con menos carga. También funciona en modo manual.
- 👥 **Roles y accesos:** super admin, admin y usuario, con matriz de accesos por sección, y personal con cargos y áreas.
- 📊 **Dashboard de métricas** e histórico por empleado.

<details>
<summary>➕ <b>Todas las funciones</b></summary>

- 🕓 **Historial de cambios** de cada ticket y exportación a CSV.
- 🔔 **Notificaciones** dentro de la app.
- 🗑️ **Papelera** con restauración.

</details>

## 🧱 Tecnologías

| Pieza | Tecnología |
|---|---|
| 🖥️ Interfaz | React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts |
| 🔥 Backend | Firebase (Auth, Firestore, Storage, Cloud Functions v2) |
| 🤖 IA | Groq |
| ☁️ Hosting | Vercel (frontend) y Firebase (reglas y funciones) |

## 📋 Requisitos

| Necesitas | Detalle |
|---|---|
| 🟢 Node y pnpm | Node 24 para el frontend (las Cloud Functions usan Node 22) |
| 🔥 Firebase CLI | `npm i -g firebase-tools` y `firebase login` |
| 💳 Proyecto Firebase en plan **Blaze** | Lo exigen las Cloud Functions; el uso normal entra en la capa gratuita |
| 🔑 API key de [Groq](https://console.groq.com) | Alcanza el plan gratis |

## 🚀 Cómo levantarlo

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
8. **Crea el primer usuario de inmediato:** en una instalación nueva, `/login` lleva a `/setup`, donde se crea el super admin. Las demás cuentas se crean en *Administración → Usuarios*. ✅

## ⚙️ Configuración

| Variable | Para qué | Ejemplo de formato |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | `firebaseConfig` de la app web (es público: la seguridad está en las reglas y las funciones) | valores de *Project Settings → Tus apps* |
| `VITE_RECAPTCHA_SITE_KEY` | Opcional: activa App Check con reCAPTCHA v3 | site key pública de reCAPTCHA v3 |
| `GROQ_API_KEY` | Secreto de Cloud Functions para la IA (no va en `.env`) | `firebase functions:secrets:set GROQ_API_KEY` |

**App Check (recomendado):** crea la clave reCAPTCHA v3 para tu dominio y `localhost`, regístrala en *Firebase → App Check* con TTL de 24 h y ponla en `VITE_RECAPTCHA_SITE_KEY`.

**⚠️ Ojo con esto:**

| Si haces esto | Qué pasa |
|---|---|
| Tardar en crear el super admin | Mientras no exista, cualquiera que entre a `/setup` podría crearlo |
| Activar **Enforce** de App Check antes de tiempo | La app deja de funcionar: actívalo solo cuando App Check muestre las peticiones como verificadas |
| Borrar el secreto `GROQ_API_KEY` entero | Pierde su permiso y el siguiente deploy falla: para cambiar la key, vuelve a correr `secrets:set` |
| Cambiar la key y no redesplegar | Las funciones siguen con la vieja: despliega `functions:asignarTicketIA,functions:reanalizarTicketIA` |

## 🌐 Despliegue

- **Frontend:** importa el repo en Vercel y carga las variables `VITE_*` en *Project Settings → Environment Variables*. Build: `pnpm build` → `dist`.
- **Reglas y funciones:** `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`.

Sitio de ejemplo: https://apolo-core.vercel.app

## 📜 Licencia

[MIT](LICENSE).
