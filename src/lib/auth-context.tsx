import React, { createContext, useContext, useEffect, useState } from "react";
import { GitHubUser } from "./github";
import { clearStoredToken, getStoredToken, setStoredToken, validateToken } from "./auth";

interface AuthState {
  user: GitHubUser | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get("token");
    if (callbackToken) {
      setStoredToken(callbackToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const stored = callbackToken || getStoredToken();
    if (stored) {
      validateToken(stored).then((u) => {
        if (u) {
          setUser(u);
          setToken(stored);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const signOut = () => {
    clearStoredToken();
    setUser(null);
    setToken(null);
  };

  return <AuthContext.Provider value={{ user, token, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
