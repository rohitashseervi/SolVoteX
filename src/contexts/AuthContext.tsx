"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getUser } from "@/utils/api";

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  walletAddress?: string | null; // Server-generated Solana wallet for admins
  walletBalance?: number;
  verifications?: any[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  isAdmin: false,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("svx-token");
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser(t?: string) {
    try {
      const currentToken = t || token;
      if (!currentToken) {
        setLoading(false);
        return;
      }
      const data = await getUser();
      setUser(data.user);
    } catch (err) {
      // Token invalid — clear it
      localStorage.removeItem("svx-token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function loginFn(newToken: string, newUser: User) {
    localStorage.setItem("svx-token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("svx-token");
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    await fetchUser();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isAdmin: user?.isAdmin || false,
        loading,
        login: loginFn,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
