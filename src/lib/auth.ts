import { GitHubUser, getUser } from "./github";

const TOKEN_KEY = "gh_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getLoginUrl(): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GITHUB_CLIENT_ID not configured");
  }
  const redirectUri = `${window.location.origin}/api/auth/callback`;
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
}

export async function validateToken(token: string): Promise<GitHubUser | null> {
  try {
    return await getUser(token);
  } catch {
    clearStoredToken();
    return null;
  }
}
