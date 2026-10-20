import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AccessProvider } from './context/AccessContext';
import { TicketsProvider } from './context/TicketsContext';
import { CatalogosProvider } from './context/CatalogosContext';
import { AppRoutes } from './routes/AppRoutes';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccessProvider>
          <TicketsProvider>
            <CatalogosProvider>
              <AppRoutes />
            </CatalogosProvider>
          </TicketsProvider>
        </AccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;