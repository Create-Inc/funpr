import { GitHubUser, getUser } from "./github";

const TOKEN_KEY = "gh_token";
const STATE_COOKIE = "gh_oauth_state";
const STATE_SESSION_KEY = "gh_oauth_state";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getLoginUrl(): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GITHUB_CLIENT_ID not configured");
  }
  const redirectUri = `${window.location.origin}/api/auth/callback`;

  // Generate a CSRF state and pin it both in a cookie (for the server) and
  // in sessionStorage (so we can also verify it client-side if we ever want).
  const state = randomState();
  try {
    sessionStorage.setItem(STATE_SESSION_KEY, state);
  } catch {
    /* sessionStorage may be unavailable; the server cookie is the source of truth */
  }
  // 10 min, HttpOnly cannot be set from JS but SameSite=Lax + Secure is fine.
  document.cookie = `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; Max-Age=600; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Parse a token out of the current URL fragment (set by the OAuth callback
 * redirect) and return it. Returns null if no token is in the fragment.
 *
 * Using the fragment instead of a query parameter keeps the token out of
 * server access logs, referrer headers, and most history-sync paths.
 */
export function consumeCallbackToken(): string | null {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  if (!token) return null;
  // Wipe the fragment so the token isn't visible in the address bar.
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
  return token;
}

export async function validateToken(token: string): Promise<GitHubUser | null> {
  try {
    return await getUser(token);
  } catch {
    clearStoredToken();
    return null;
  }
}
