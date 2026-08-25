import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { cargosService, areasService } from "../services/catalogosService";
import { SetupGuard } from "./SetupGuard";
import { ProtectedRoute } from "./ProtectedRoute";
import { AccessGuard } from "./AccessGuard";
import { AppLayout } from "../components/layout/AppLayout";
import { PageSpinner } from "../components/ui/spinner";

// Cada pantalla queda en su propio chunk, cargado recién al navegar a esa
// ruta -- antes todo (Dashboard con Recharts, Tickets, Personal,
// Administración, etc.) iba en un solo bundle de 1.5MB+ que se descargaba
// entero para entrar a cualquier pantalla, aunque fuera la primera. Login
// queda eager: es la pantalla de entrada de la app sin sesión, no tiene
// sentido partirla.
const Setup = lazy(() => import("../pages/Setup").then((m) => ({ default: m.Setup })));
const Home = lazy(() => import("../pages/Home").then((m) => ({ default: m.Home })));
const Notificaciones = lazy(() => import("../pages/Notificaciones").then((m) => ({ default: m.Notificaciones })));
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const TicketsList = lazy(() => import("../pages/tickets/TicketsList").then((m) => ({ default: m.TicketsList })));
const TicketNew = lazy(() => import("../pages/tickets/TicketNew").then((m) => ({ default: m.TicketNew })));
const TicketEdit = lazy(() => import("../pages/tickets/TicketEdit").then((m) => ({ default: m.TicketEdit })));
const TicketDetail = lazy(() => import("../pages/tickets/TicketDetail").then((m) => ({ default: m.TicketDetail })));
const PersonalPage = lazy(() => import("../pages/personal/PersonalPage").then((m) => ({ default: m.PersonalPage })));
const Historico = lazy(() => import("../pages/Historico").then((m) => ({ default: m.Historico })));
const HistoricoDetalle = lazy(() => import("../pages/HistoricoDetalle").then((m) => ({ default: m.HistoricoDetalle })));
const Administracion = lazy(() => import("../pages/administracion/Administracion").then((m) => ({ default: m.Administracion })));
const ModoTab = lazy(() => import("../pages/administracion/tabs/ModoTab").then((m) => ({ default: m.ModoTab })));
const UsuariosTab = lazy(() => import("../pages/administracion/tabs/UsuariosTab").then((m) => ({ default: m.UsuariosTab })));
const AccesosTab = lazy(() => import("../pages/administracion/tabs/AccesosTab").then((m) => ({ default: m.AccesosTab })));
const Papelera = lazy(() => import("../pages/Papelera").then((m) => ({ default: m.Papelera })));
const EmpleadosTab = lazy(() => import("../components/personal/EmpleadosTab").then((m) => ({ default: m.EmpleadosTab })));
const CatalogoCrud = lazy(() => import("../components/personal/CatalogoCrud").then((m) => ({ default: m.CatalogoCrud })));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
      <Route
        path="/setup"
        element={
          <SetupGuard>
            <Setup />
          </SetupGuard>
        }
      />
      <Route path="/login" element={<Login />} />

      {/* Rutas Protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Home />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute>
            <AccessGuard section="notificaciones">
              <AppLayout>
                <Notificaciones />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AccessGuard section="dashboard">
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <AccessGuard section="tickets">
              <AppLayout>
                <TicketsList />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/nuevo"
        element={
          <ProtectedRoute>
            <AccessGuard section="tickets">
              <AppLayout>
                <TicketNew />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/:id"
        element={
          <ProtectedRoute>
            <AccessGuard section="tickets">
              <AppLayout>
                <TicketDetail />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/:id/editar"
        element={
          <ProtectedRoute>
            <AccessGuard section="tickets">
              <AppLayout>
                <TicketEdit />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/personal"
        element={
          <ProtectedRoute>
            <AccessGuard section="personal">
              <AppLayout>
                <PersonalPage />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/historico"
        element={
          <ProtectedRoute>
            <AccessGuard section="historico">
              <AppLayout>
                <Historico />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/historico/:id"
        element={
          <ProtectedRoute>
            <AccessGuard section="historico">
              <AppLayout>
                <HistoricoDetalle />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      />

      <Route
        path="/administracion"
        element={
          <ProtectedRoute>
            <AccessGuard section="administracion">
              <AppLayout>
                <Administracion />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      >
        <Route path="modo" element={<ModoTab />} />
        <Route path="usuarios" element={<UsuariosTab />} />
        <Route path="accesos" element={<AccesosTab />} />
      </Route>

      <Route
        path="/papelera"
        element={
          <ProtectedRoute>
            <AccessGuard section="papelera">
              <AppLayout>
                <Papelera />
              </AppLayout>
            </AccessGuard>
          </ProtectedRoute>
        }
      >
        <Route path="tickets" element={<TicketsList soloPapelera />} />
        <Route path="empleados" element={<EmpleadosTab soloPapelera />} />
        <Route path="cargos" element={<CatalogoCrud singular="cargo" service={cargosService} soloPapelera />} />
        <Route path="areas" element={<CatalogoCrud singular="área" service={areasService} soloPapelera />} />
        <Route path="usuarios" element={<UsuariosTab soloPapelera />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
