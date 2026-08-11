import { AuthProvider } from './context/AuthContext';
import { AccessProvider } from './context/AccessContext';
import { AppRoutes } from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <AccessProvider>
        <AppRoutes />
      </AccessProvider>
    </AuthProvider>
  );
}

export default App;