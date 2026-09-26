import type { Save } from "./storage";

export interface AuthUser {
  id: string;
  email: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Une erreur est survenue.");
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const getCurrentUser = () => request<{ user: AuthUser }>("/api/auth/me");
export const login = (email: string, password: string) =>
  request<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const register = (email: string, password: string) =>
  request<{ user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const logout = () =>
  request<void>("/api/auth/logout", { method: "POST" });
export const loadRemoteSave = () => request<{ save: Save | null }>("/api/save");
export const saveRemoteSave = (save: Save) =>
  request<void>("/api/save", { method: "PUT", body: JSON.stringify(save) });
