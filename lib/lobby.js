"use client";

// Lightweight lobby store shared between the join-host and lobby screens.
// Populated by Socket.IO `room:joined` / `room:players` events. Persisted to
// sessionStorage so a full-page refresh (e.g. reloading /lobby) restores the
// room identity instead of resetting to an empty lobby.

const STORAGE_KEY = "mobduel_lobby";

const initialState = {
  roomId: null,
  code: null,
  status: null,
  players: [],
  isHost: false,
};

function loadInitial() {
  if (typeof window === "undefined") return { ...initialState };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...initialState };
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return { ...initialState };
  }
}

let state = loadInitial();

const listeners = new Set();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy errors
  }
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

const lobby = {
  getState: () => state,
  setSnapshot(snapshot, isHost) {
    state = {
      roomId: snapshot.roomId ?? null,
      code: snapshot.code ?? null,
      status: snapshot.status ?? null,
      players: snapshot.players || [],
      isHost: typeof isHost === "boolean" ? isHost : state.isHost,
    };
    persist();
    emit();
  },
  update(partial) {
    state = { ...state, ...partial };
    persist();
    emit();
  },
  reset() {
    state = { ...initialState };
    persist();
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default lobby;
