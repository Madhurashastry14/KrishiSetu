import React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then(({ user: current }) => setUser(current))
      .catch((error) => {
        setUser(null);
        if (error.status !== 401) setAuthError(error.message);
      })
      .finally(() => setReady(true));
  }, []);
  const value = {
    user,
    ready,
    authError,
    async login(credentials) {
      const result = await api("/auth/login", {
        method: "POST",
        body: credentials,
      });
      setUser(result.user);
    },
    async register(details) {
      const result = await api("/auth/register", {
        method: "POST",
        body: details,
      });
      setUser(result.user);
    },
    async logout() {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    },
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
