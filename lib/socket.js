"use client";

import { io } from "socket.io-client";
import { apiOrigin } from "./server";

// Resolve the Socket.IO origin at runtime from the current page hostname so it
// tracks the server's current IP automatically. No IP is baked into the bundle.
const SOCKET_URL = apiOrigin();

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
