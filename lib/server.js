"use client";

// Runtime backend-address resolver.
//
// The Next.js dev server and the NestJS backend run on the SAME machine, so we
// never need to bake the server's IP into the client bundle. The backend port
// is the only thing taken from NEXT_PUBLIC_API_BASE; the HOST is derived at
// runtime from the browser's current page origin. When the server's IP changes,
// the client simply opens the page at the new IP and every REST + Socket.IO
// call automatically targets the new address.

const DEFAULT_API_PORT = 3001;

function backendPort() {
  const base = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : "") || "";
  try {
    const parsed = new URL(base);
    if (parsed.port) return parsed.port;
  } catch {
    // ignore a malformed env value and fall through to the default port
  }
  return String(DEFAULT_API_PORT);
}

// Base for REST calls, e.g. http://192.168.x.x:3001/api
export function apiBase() {
  if (typeof window === "undefined") {
    // Server-rendered fallback: the backend is on this machine in dev.
    return process.env.NEXT_PUBLIC_API_BASE || `http://localhost:${backendPort()}/api`;
  }
  return `${window.location.protocol}//${window.location.hostname}:${backendPort()}/api`;
}

// Origin only (no /api), e.g. http://192.168.x.x:3001 — for Socket.IO.
export function apiOrigin() {
  return apiBase().replace(/\/api\/?$/, "");
}