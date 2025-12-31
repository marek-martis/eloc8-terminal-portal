"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  preferences?: Record<string, unknown>;
  defaultMapCenter?: { lat: number; lng: number } | null;
  defaultZoom?: number | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setAccessToken(data.accessToken);
      }
    } catch (error) {
      console.error("Session check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      setUser(data.user);
      setAccessToken(data.accessToken);
      router.push("/map");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setAccessToken(null);
      router.push("/login");
    }
  }, [router]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
        return data.accessToken;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
    }
    return null;
  }, [logout]);

  useEffect(() => {
    if (!accessToken) return;

    const refreshInterval = setInterval(
      () => {
        refreshToken();
      },
      2 * 60 * 60 * 1000
    );

    return () => clearInterval(refreshInterval);
  }, [accessToken, refreshToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
