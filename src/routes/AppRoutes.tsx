import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { Setup } from "../pages/Setup";
import { Home } from "../pages/Home";
import { Notificaciones } from "../pages/Notificaciones";
import { Dashboard } from "../pages/Dashboard";
import { TicketsList } from "../pages/tickets/TicketsList";
import { TicketNew } from "../pages/tickets/TicketNew";
import { TicketEdit } from "../pages/tickets/TicketEdit";
import { TicketDetail } from "../pages/tickets/TicketDetail";
import { PersonalPage } from "../pages/personal/PersonalPage";
import { Administracion } from "../pages/administracion/Administracion";
import { ModoTab } from "../pages/administracion/tabs/ModoTab";
import { UsuariosTab } from "../pages/administracion/tabs/UsuariosTab";
import { AccesosTab } from "../pages/administracion/tabs/AccesosTab";
import { Papelera } from "../pages/Papelera";
import { EmpleadosTab } from "../components/personal/EmpleadosTab";
import { CatalogoCrud } from "../components/personal/CatalogoCrud";
import { cargosService, areasService } from "../services/catalogosService";
import { SetupGuard } from "./SetupGuard";
import { ProtectedRoute } from "./ProtectedRoute";
import { AccessGuard } from "./AccessGuard";
import { AppLayout } from "../components/layout/AppLayout";

export const AppRoutes: React.FC = () => {
  return (
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
  );
};
