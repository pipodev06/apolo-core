import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "../firebase";
import { authService } from "../services/authService";

interface Session {
  userId: string;
  username: string;
  role: string;
  personalId?: string;
  expiresAt: number;
}

interface AuthContextType {
  user: Session | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lectura de localStorage, es síncrona: no hace falta un efecto ni un
  // estado de "cargando" para esperar nada, se resuelve en el primer render.
  const [user, setUser] = useState<Session | null>(() => authService.getSession());

  // La sesión de localStorage es solo para pintar la UI sin esperar; la
  // fuente de verdad es Firebase Auth. Si Auth no tiene sesión (revocada por
  // un admin, expirada, borrada a mano) se cierra la de la UI; si la tiene,
  // rol y personalId se toman de los claims del token (no del localStorage,
  // que se puede editar a mano).
  useEffect(() => {
    return onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (authService.getSession()) {
          authService.logout();
          setUser(null);
        }
        return;
      }
      const { claims } = await fbUser.getIdTokenResult();
      const role = typeof claims.role === "string" ? claims.role : "usuario";
      const personalId = typeof claims.personalId === "string" ? claims.personalId : undefined;
      const actual = authService.getSession();
      if (!actual || (actual.role === role && actual.personalId === personalId)) return;
      const actualizada = { ...actual, role, personalId };
      localStorage.setItem("session", JSON.stringify(actualizada));
      setUser(actualizada);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const session = await authService.login(username, password);
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
