import { apiBase } from "./server";

const TOKEN_KEY = "mobduel_token";
const PLAYER_KEY = "mobduel_player";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredPlayer() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PLAYER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession({ token, player }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PLAYER_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message
      : "Something went wrong. Please try again.";
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export function register(name, password, email) {
  return request("/auth/register", {
    method: "POST",
    body: { name, password, ...(email ? { email } : {}) },
  });
}

export function login(name, password) {
  return request("/auth/login", { method: "POST", body: { name, password } });
}

// Verify the stored token is still valid; returns the player or null.
export async function verifySession() {
  const token = getToken();
  if (!token) return null;
  try {
    const player = await request("/auth/me");
    setSession({ token, player });
    return player;
  } catch {
    clearSession();
    return null;
  }
}
