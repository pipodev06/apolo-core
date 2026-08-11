# apolo-core

Sistema de gestión de tickets de incidencias. SPA en **React 19 + Vite + TypeScript + Tailwind v4** con **Firebase** (Auth, Firestore, Cloud Functions, Hosting). Roles (super admin / admin / usuario), matriz de accesos por sección, módulo de personal (cargos y áreas), papelera con restauración, notificaciones in-app, dashboard de métricas (Recharts) y asignación automática de tickets por IA (SambaNova).

## Stack
- Frontend: React 19, Vite 8, TypeScript, TailwindCSS v4, shadcn/ui
- Backend (BaaS): Firebase — Firestore, Auth (custom tokens), Cloud Functions v2, Hosting
- IA de asignación: SambaNova (Cloud Function `analizarYAsignar`)
- Auth propia (bcryptjs + SHA-256) sobre Firebase Auth custom tokens, SweetAlert2

## Desarrollo
```bash
pnpm install
pnpm dev
```

## Build
```bash
pnpm build
```

> La configuración de Firebase en `src/firebase.ts` es pública por diseño (no es un secreto) — es el mismo `firebaseConfig` que ya viaja en el bundle de cualquier sitio Firebase. La seguridad real depende de `firestore.rules`, no de esconder esa config.

## Puesta en marcha con Firebase (desde cero)

1. **Crear un proyecto Firebase** ([console.firebase.google.com](https://console.firebase.google.com)) y habilitar: Authentication, Firestore, Cloud Functions y Hosting.
2. **Apuntar el frontend a tu proyecto**: reemplaza el objeto `firebaseConfig` de `src/firebase.ts` por el de tu propio proyecto (Project Settings → General → tu app web). No hace falta ocultarlo, ver nota arriba.
3. **Configurar el secreto de la IA** (SambaNova, usado por las Cloud Functions de asignación automática):
   ```bash
   firebase functions:secrets:set SAMBANOVA_API_KEY
   ```
4. **Desplegar reglas y funciones**:
   ```bash
   firebase deploy --only firestore:rules,functions
   ```

### Primer usuario (super_admin)

El sistema no trae usuarios precargados — el primer super_admin se crea desde la propia app:

1. Levanta el frontend (`pnpm dev`) y entra a **`/setup`**.
2. Completa usuario, contraseña y (opcional) email. Ese usuario queda creado con rol `super_admin` y acceso total a todas las secciones.
3. Esa ventana de "bootstrap" se cierra sola apenas se crea el primer usuario: `/setup` deja de estar disponible (redirige a `/login`) y `firestore.rules` deja de aceptar escrituras sin sesión a partir de ese momento — no hay forma de volver a `/setup` salvo borrando manualmente el documento `config/app` en Firestore.

### Gestión posterior

De ahí en más, **todo se gestiona desde la propia app**, logueado como `admin`/`super_admin` — no hace falta tocar la consola de Firebase para el día a día:

- **Usuarios y roles** → `/administracion/usuarios` (crear, desactivar, cambiar rol; solo `super_admin` puede tocar otro `super_admin` o renombrar usuarios).
- **Permisos por sección** (Dashboard, Tickets, Personal, Administración, Notificaciones, Papelera) → `/administracion/accesos`.
- **Modo de asignación de tickets** (manual vs. IA) → `/administracion/modo`.
- **Personal, cargos y áreas** → `/personal`.
- **Papelera / restaurar / eliminar definitivo** → `/papelera`.

La consola de Firebase solo hace falta para tareas de infraestructura, no de negocio: ver logs de Cloud Functions (`firebase functions:log`), rotar el secreto de SambaNova, o inspeccionar datos crudos de Firestore si hace falta debuggear algo puntual.
