import React, { createContext, useContext, useEffect, useState } from "react";
import { GitHubUser } from "./github";
import { clearStoredToken, consumeCallbackToken, getStoredToken, setStoredToken, validateToken } from "./auth";

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
    // OAuth callback delivers the token in the URL fragment (#token=...),
    // which keeps it out of server logs and referrer headers.
    const callbackToken = consumeCallbackToken();
    if (callbackToken) {
      setStoredToken(callbackToken);
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
