import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
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
  // fuente de verdad es Firebase Auth + el doc users/{uid} (el mismo que
  // leen las reglas). Sin sesión de Auth, o si la cuenta se desactiva, va a
  // la papelera o deja de existir, se cierra la de la UI al instante. Rol,
  // personalId y username se toman del doc (el localStorage se puede editar
  // a mano). Solo se actúa si ya hay sesión de UI: durante el login, la
  // verificación la hace authService.login.
  useEffect(() => {
    let dejarDeEscuchar: (() => void) | undefined;
    const cerrar = () => {
      if (!authService.getSession()) return;
      authService.logout();
      setUser(null);
    };

    const dejarDeEscucharAuth = onAuthStateChanged(auth, (fbUser) => {
      dejarDeEscuchar?.();
      dejarDeEscuchar = undefined;
      if (!fbUser) {
        cerrar();
        return;
      }
      dejarDeEscuchar = onSnapshot(
        doc(db, "users", fbUser.uid),
        (snap) => {
          const data = snap.data();
          if (!data || data.active !== true || data.deletedAt) {
            cerrar();
            return;
          }
          const actual = authService.getSession();
          if (!actual || actual.userId !== fbUser.uid) return;
          const role = data.role as string;
          const personalId = (data.personalId as string | undefined) || undefined;
          const username = data.username as string;
          if (actual.role === role && actual.personalId === personalId && actual.username === username) return;
          const actualizada = { ...actual, role, personalId, username };
          localStorage.setItem("session", JSON.stringify(actualizada));
          setUser(actualizada);
        },
        // Sin permiso de lectura = cuenta desactivada (reglas).
        cerrar
      );
    });

    return () => {
      dejarDeEscucharAuth();
      dejarDeEscuchar?.();
    };
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
