# apolo-core

Sistema de gestión de tickets de incidencias para equipos de TI. SPA en **React 19 + Vite + TypeScript + Tailwind v4** con **Firebase** (Auth, Firestore, Storage, Cloud Functions). El frontend se despliega en **Vercel**.

Incluye roles (super admin / admin / usuario), matriz de accesos por sección, personal con cargos y áreas, categorías de ticket, SLA por urgencia, notificaciones in-app, dashboard de métricas, histórico por empleado, export CSV, papelera con restauración y asignación automática de tickets por IA (Groq).

Es una app **single-tenant**: cada empresa usa su propio proyecto de Firebase.

## Stack
- Frontend: React 19, Vite 8, TypeScript, TailwindCSS v4, shadcn/ui, Recharts
- Backend (BaaS): Firebase — Firestore, Auth (custom tokens), Storage, Cloud Functions v2
- Hosting del frontend: Vercel (`vercel.json`, build `pnpm run build` → `dist`)
- IA de asignación: Groq, modelo `openai/gpt-oss-120b` (Cloud Functions `asignarTicketIA` / `reanalizarTicketIA`)
- Contraseñas: bcrypt **server-side** en Cloud Functions; los hashes viven en `credenciales/`, sin acceso desde el cliente

## Desarrollo
```bash
cp .env.example .env   # y completa los valores de tu proyecto Firebase
pnpm install
pnpm dev
```

## Build
```bash
pnpm build
```

> La configuración web de Firebase (`VITE_FIREBASE_*` en `.env`) no es un secreto: es el mismo `firebaseConfig` que viaja en el bundle de cualquier sitio Firebase. La seguridad real está en `firestore.rules`, `storage.rules` y las Cloud Functions.

## Demo

Hay una instancia pública en **[apolo-core.vercel.app](https://apolo-core.vercel.app)** con dos cuentas de prueba:

| Usuario | Contraseña | Rol | Qué puede hacer |
|---|---|---|---|
| `demo.admin` | `DemoAdmin2026` | Admin | Ve todos los tickets; gestiona usuarios, personal, categorías, accesos y configuración |
| `demo.usuario` | `DemoUsuario2026` | Usuario | Crea tickets y ve solo los suyos (y los asignados, si su cuenta está vinculada a un técnico) |

> Es una demo compartida: los datos pueden cambiar o reiniciarse en cualquier momento. No cargues información real.

## Puesta en marcha con Firebase (desde cero)

Cada instalación usa **su propio proyecto Firebase**: no alcanza con clonar y completar el `.env`, también hay que desplegar reglas y Cloud Functions en tu proyecto.

### Requisitos
- Node 22 y pnpm
- Firebase CLI (`npm i -g firebase-tools`, luego `firebase login`)
- Un proyecto Firebase en plan **Blaze** (Cloud Functions lo exige; el uso normal entra en la capa gratuita)

### Pasos

1. **Crea el proyecto** en [console.firebase.google.com](https://console.firebase.google.com) y, dentro de él:
   - **Firestore Database** → *Crear base de datos* (modo producción; las reglas se despliegan después).
   - **Storage** → *Comenzar* (crea el bucket).
   - **Authentication** → *Comenzar*. No hace falta habilitar ningún proveedor: el login usa *custom tokens* emitidos por la Function `login`.
   - **Project Settings → General → Tus apps** → agrega una app **Web** para obtener el `firebaseConfig`.
2. **Apunta el frontend a tu proyecto**: `cp .env.example .env` y completa las variables `VITE_FIREBASE_*` con ese `firebaseConfig`.
3. **Apunta la CLI a tu proyecto**: `.firebaserc` trae el id del proyecto original. Reemplázalo por el tuyo o ejecuta `firebase use --add`.
4. **Secreto de la IA** (Groq). Créalo aunque no vayas a usar la asignación por IA, porque el deploy de funciones lo pide:
   ```bash
   firebase functions:secrets:set GROQ_API_KEY
   ```
   Consigue la key en [console.groq.com](https://console.groq.com) → API Keys (alcanza el free tier). Si no vas a usar IA, carga cualquier valor y deja la asignación en modo **manual**.
5. **Permiso para emitir tokens de login** (si no, el login falla con `iam.serviceAccounts.signBlob denied`). En [Google Cloud Console](https://console.cloud.google.com) del mismo proyecto:
   - **APIs y servicios** → habilita **IAM Service Account Credentials API**.
   - **IAM** → a la cuenta de servicio de las Functions (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`) agrégale el rol **Creador de tokens de cuenta de servicio** (*Service Account Token Creator*).
6. **Despliega reglas, índices, Storage y funciones** (siempre juntos, las reglas dependen de las funciones):
   ```bash
   (cd functions && npm install)
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
7. **Frontend**:
   - Local: `pnpm install && pnpm dev`
   - Vercel: importa el repo y carga las mismas variables `VITE_FIREBASE_*` en *Project Settings → Environment Variables*.
8. **Crea el primer usuario** (ver abajo).

### Primer usuario (super_admin)

El sistema no trae usuarios precargados. **Haz este paso apenas despliegues**, porque hasta que se complete cualquiera que entre a `/setup` puede crear el primer super_admin:

1. Abre la app. En una instalación nueva, `/login` redirige solo a **`/setup`**.
2. Completa usuario (mín. 3 caracteres), contraseña (mín. 8) y email (opcional). La Cloud Function `setupInicial` crea en una sola operación:
   - el usuario `super_admin` (`users/`, hash bcrypt en `credenciales/` y permisos en `access/`);
   - la configuración inicial `config/app` (serie `TK01`, asignación manual, máx. 5 tickets abiertos por técnico);
   - la marca pública `publico/estado` (`inicializado: true`).
3. Desde ese momento `/setup` redirige a `/login` y la función rechaza cualquier otro intento.
4. El resto de cuentas se crean desde **Administración → Usuarios**.

### Cargar datos de ejemplo (para una demo)

Con el super_admin, en este orden:

1. **Personal → Áreas y Cargos**: por ejemplo áreas *Soporte*, *Redes*, *Sistemas*; cargos *Técnico de soporte*, *Administrador de redes*.
2. **Personal → Empleados**: los técnicos a los que se asignan tickets, cada uno con su área.
3. **Administración → Categorías** (ver abajo).
4. **Administración → Usuarios**: las cuentas demo (`demo.admin` con rol Admin, `demo.usuario` con rol Usuario). Si una cuenta *Usuario* se vincula a un técnico de Personal, también ve y puede cerrar los tickets asignados a ese técnico.
5. **Administración → Accesos**: revisa qué secciones ve cada cuenta *Usuario* (admins y super_admins ven todo siempre).
6. Crea algunos tickets con distintas urgencias y categorías para que el Dashboard tenga datos.

### Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| El login responde `internal` | Falta el permiso del paso 5. Revisa `firebase functions:log`. |
| `/setup` o el login tardan varios segundos la primera vez | *Cold start* de Cloud Functions (arrancan en frío tras un rato sin uso). |
| Una lista queda vacía o da error de índice | Faltó `firestore:indexes` en el deploy. |
| El deploy de funciones pide `GROQ_API_KEY` | Falta el paso 4. |

## Categorías de ticket

Las categorías clasifican el tipo de incidencia. Son un catálogo que se administra en **Administración → Categorías** (crear, editar, activar/desactivar, mandar a la papelera).

- Al **crear o editar un ticket** aparece el campo *Categoría* con las categorías **activas** (es opcional: "Sin categoría").
- Si una categoría se desactiva, deja de ofrecerse en tickets nuevos pero los tickets que ya la tienen la conservan.
- La categoría se ve en el detalle del ticket, sale en el export CSV y entra en la búsqueda del listado de tickets.

Ejemplos para empezar:

| Categoría | Para qué |
|---|---|
| Hardware | PC, laptop, periféricos que fallan o no encienden |
| Software | Instalación, licencias o errores de aplicaciones |
| Red e Internet | Sin conexión, Wi-Fi, VPN, lentitud de red |
| Impresoras | Atascos, drivers, impresión en red |
| Correo | Cuenta, buzón lleno, envío/recepción |
| Accesos y cuentas | Altas, bajas, contraseñas, permisos en sistemas |
| Telefonía | Anexos, centralita, celulares corporativos |
| Otros | Lo que no encaje en las anteriores |

## Gestión desde la app

Todo el día a día se gestiona logueado como `admin`/`super_admin`:

- **Usuarios y roles** → `/administracion/usuarios` (crear, desactivar, cambiar rol o contraseña; solo `super_admin` toca otro `super_admin`). Desactivar, eliminar o cambiar el rol de alguien cierra sus sesiones abiertas.
- **Configuración** → `/administracion/modo`: asignación manual o por IA, máximo de tickets abiertos por empleado y horas de SLA por urgencia.
- **Categorías de ticket** → `/administracion/categorias`.
- **Permisos por sección** → `/administracion/accesos`.
- **Personal, cargos y áreas** → `/personal`.
- **Papelera** (restaurar / eliminar definitivo) → `/papelera`.

Cada usuario cambia su propia contraseña con el ícono de llave del encabezado.

### Visibilidad de tickets

- **Admin / super_admin**: ven todos los tickets.
- **Usuario**: ve los que creó y, si su cuenta está vinculada a un técnico de Personal, los que tiene asignados (y puede cerrarlos).

## Seguridad (resumen)

- Login vía Cloud Function con bloqueo tras 5 intentos fallidos en 15 minutos.
- Toda lectura de Firestore exige sesión, salvo `publico/estado` (solo indica si la app ya fue inicializada).
- Las imágenes adjuntas solo las puede borrar quien las subió o un admin.

La consola de Firebase solo hace falta para infraestructura: logs (`firebase functions:log`), rotar `GROQ_API_KEY` o revisar datos puntuales.
