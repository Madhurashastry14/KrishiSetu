import React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    async function loadCurrentUser() {
      try {
        const result = await api("/auth/me");
        if (!result || typeof result !== "object" || !("user" in result))
          throw new Error("The server returned an invalid authentication response.");
        if (active) {
          setUser(result.user);
          setAuthError("");
        }
      } catch (error) {
        if (!active) return;
        setUser(null);
        if (error.status !== 401) setAuthError(error.message);
      } finally {
        if (active) setReady(true);
      }
    }
    loadCurrentUser();
    return () => {
      active = false;
    };
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
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within an AuthProvider.");
  return context;
}
