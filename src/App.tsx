import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AccessProvider } from './context/AccessContext';
import { AppRoutes } from './routes/AppRoutes';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccessProvider>
          <AppRoutes />
        </AccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;