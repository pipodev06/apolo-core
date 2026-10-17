# apolo-core

Sistema de gestión de tickets de incidencias para equipos de TI. SPA en **React 19 + Vite + TypeScript + Tailwind v4** con **Firebase** (Auth, Firestore, Storage, Cloud Functions). El frontend se despliega en **Vercel**.

Incluye roles (super admin / admin / usuario), matriz de accesos por sección, personal con cargos y áreas, categorías de ticket, SLA por urgencia, notificaciones in-app y por correo (opcional), dashboard de métricas, histórico por empleado, export CSV, papelera con restauración y asignación automática de tickets por IA (Groq).

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

## Puesta en marcha con Firebase (desde cero)

1. **Crea un proyecto Firebase** ([console.firebase.google.com](https://console.firebase.google.com)) y habilita Authentication, Firestore, Storage y Cloud Functions (plan Blaze).
2. **Apunta el frontend a tu proyecto**: copia `.env.example` a `.env` y completa las variables `VITE_FIREBASE_*` con los datos de tu app web (Project Settings → General).
3. **Apunta la CLI a tu proyecto**: reemplaza el id en `.firebaserc` (`projects.default`) por el tuyo.
4. **Consigue una API key de Groq**: crea una cuenta en [console.groq.com](https://console.groq.com) → API Keys. El free tier alcanza para el uso normal.
5. **Configura el secreto de la IA**:
   ```bash
   firebase functions:secrets:set GROQ_API_KEY
   ```
6. **Despliega reglas, Storage y funciones** (siempre juntos, las reglas dependen de las funciones):
   ```bash
   firebase deploy --only firestore:rules,storage,functions
   ```

7. **Despliega el frontend en Vercel**: importa el repo y carga las mismas variables `VITE_FIREBASE_*` en Project Settings → Environment Variables.

### Primer usuario (super_admin)

El sistema no trae usuarios precargados. **Haz este paso apenas despliegues**, porque hasta que se complete cualquiera que entre a `/setup` puede crear el primer super_admin:

1. Entra a **`/setup`** (con `pnpm dev` o en la URL desplegada).
2. Completa usuario, contraseña y (opcional) email. La Cloud Function `setupInicial` crea el super_admin y la configuración inicial.
3. Desde ese momento `/setup` redirige a `/login` y la función rechaza cualquier otro intento.

### Correo (opcional)

Las notificaciones salen siempre in-app. Para enviarlas también por correo:

1. Instala la extensión oficial **"Trigger Email from Firestore"** (`firebase/firestore-send-email`) en tu proyecto, con la colección **`mail`** y los datos de tu servidor SMTP.
2. En la app: Administración → Configuración → marca "Enviar también las notificaciones por correo".

Solo reciben correo los usuarios con email registrado.

## Gestión desde la app

Todo el día a día se gestiona logueado como `admin`/`super_admin`:

- **Usuarios y roles** → `/administracion/usuarios` (crear, desactivar, cambiar rol o contraseña; solo `super_admin` toca otro `super_admin`). Desactivar, eliminar o cambiar el rol de alguien cierra sus sesiones abiertas.
- **Configuración** → `/administracion/modo`: asignación manual o por IA, máximo de tickets abiertos por empleado, horas de SLA por urgencia y correo.
- **Categorías de ticket** → `/administracion/categorias`.
- **Permisos por sección** → `/administracion/accesos`.
- **Personal, cargos y áreas** → `/personal`.
- **Papelera** (restaurar / eliminar definitivo) → `/papelera`.

Cada usuario cambia su propia contraseña con el ícono de llave del encabezado.

### Visibilidad de tickets

- **Admin / super_admin**: ven todos los tickets.
- **Usuario**: ve los que creó y, si su cuenta está vinculada a un técnico de Personal, los que tiene asignados (y puede cerrarlos).

### Modo IA y privacidad

En modo IA, el título y la descripción de cada ticket se envían a Groq (proveedor externo) para clasificarlo. Si la información no puede salir de la empresa, usa el modo manual.

## Seguridad (resumen)

- Login vía Cloud Function con bloqueo tras 5 intentos fallidos en 15 minutos.
- Toda lectura de Firestore exige sesión, salvo `publico/estado` (solo indica si la app ya fue inicializada).
- Las imágenes adjuntas solo las puede borrar quien las subió o un admin.

La consola de Firebase solo hace falta para infraestructura: logs (`firebase functions:log`), rotar `GROQ_API_KEY` o revisar datos puntuales.
