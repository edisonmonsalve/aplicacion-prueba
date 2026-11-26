import { createContext, useContext, useState, type ReactNode } from "react";
import { login, logout } from "@/services/authService";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  canOperate: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  const signIn = async (email: string, password: string) => {
    const result = await login(email, password);
    localStorage.setItem("token", result.token);
    localStorage.setItem("refreshToken", result.refreshToken);
    localStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
  };

  const signOut = () => {
    const refreshToken = localStorage.getItem("refreshToken");
    // Se revoca en el servidor, pero cerrar sesión no depende de la red.
    if (refreshToken) void logout(refreshToken).catch(() => undefined);
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  };
  const canOperate = user?.rol === "admin" || user?.rol === "operador";
  return (
    <AuthContext.Provider value={{ user, canOperate, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
