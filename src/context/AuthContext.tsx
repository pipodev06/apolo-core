import React, { createContext, useContext, useState } from "react";
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

  const login = async (username: string, password: string) => {
    const session = await authService.login(username, password);
    setUser(session);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
