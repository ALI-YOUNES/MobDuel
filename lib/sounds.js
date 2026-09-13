// Sound engine for the game. Plays real audio files (CC0 / public domain,
// from Kenney.nl) placed in /public/sounds. Falls back to a tiny Web Audio
// synthesizer when a file is missing or the fetch fails.
//
// Usage:
//   import { sfx } from "../lib/sounds";
//   sfx.place();
//   sfx.beam();
//
// Browsers block audio until a user gesture, so call `sfx.unlock()` on the
// first tap/click (BattleScreen wires this up automatically).

const BASE = "/sounds";

// Sound name -> audio file in /public/sounds.
const FILES = {
  deal: "card-deal.ogg",
  pick: "card-select.ogg",
  place: "card-place.ogg",
  click: "button-click.ogg",
  craft: "magic-spell.ogg",
  beam: "attack-laser.ogg",
  hit: "hit-impact.ogg",
  explosion: "explosion.ogg",
  power: "power-up.ogg",
  win: "victory.ogg",
  lose: "defeat.ogg",
  error: "error.ogg",
  notification: "notification.ogg",
  switch: "switch.ogg",
  tick: "tick.ogg",
  confirmation: "confirmation.ogg",
};

// Public sound names that don't have their own file map to a shared asset.
const ALIASES = {
  attackToggle: "click",
  endTurn: "click",
  handOpen: "switch",
  handClose: "switch",
  changeHand: "switch",
  move: "switch",
  slot: "tick",
  unslot: "tick",
  phaseAdvance: "tick",
  destroy: "explosion",
  trap: "explosion",
  tnt: "explosion",
  boom: "explosion",
  cooldown: "error",
  turnStart: "notification",
  totem: "notification",
  peek: "notification",
  attackerPick: "pick",
  anomaly: "power",
  void: "power",
  invisible: "power",
  respawn: "power",
  lightning: "hit",
  swap: "switch",
};

let Ctx = null;
const bufferCache = new Map();
let loaded = false;

function getCtx() {
  if (!Ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    Ctx = new AC();
  }
  if (Ctx && Ctx.state === "suspended") Ctx.resume();
  return Ctx;
}

// Preload & decode every sound file into AudioBuffers so playback is instant.
function preload() {
  const ctx = getCtx();
  if (!ctx) return;
  for (const file of Object.values(FILES)) {
    if ([...bufferCache.values()].includes(file)) continue;
    (async () => {
      try {
        const res = await fetch(`${BASE}/${file}`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        bufferCache.set(file, await ctx.decodeAudioData(buf));
      } catch {
        // ignore; falls back to synth or silence
      }
    })();
  }
}

// Resolve a sound name to a source file (or null).
function resolve(name) {
  if (FILES[name]) return name;
  if (ALIASES[name]) return ALIASES[name];
  return null;
}

// Play a decoded file. Falls back to the synth when unavailable.
function playFile(file, synthName) {
  const ctx = getCtx();
  if (!ctx) return;
  const buf = bufferCache.get(file);
  if (buf) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      const d = buf.duration;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.004);
      gain.gain.setValueAtTime(1, t + Math.max(d - 0.03, 0.01));
      gain.gain.linearRampToValueAtTime(0.0001, t + d);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return;
    } catch {
      // fall through
    }
  }
  const synth = SYNTH[synthName || file];
  if (synth) synth();
}

// ── Synthesized fallbacks (only used if a file is missing) ──────────────────

function tone(freq, type, dur, { attack = 0.01, sustain = 0.3, gain = 0.25 } = {}) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.setValueAtTime(gain, t + dur * sustain);
  env.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function sweep(startFreq, endFreq, dur, { type = "sawtooth", gain = 0.2 } = {}) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur);
  env.gain.setValueAtTime(gain, t);
  env.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(env);
  env.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur, { gain = 0.2, freq = 2000 } = {}) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const len = c.sampleRate * dur;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = 1;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(filt);
  filt.connect(env);
  env.connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SYNTH = {
  deal() { noise(0.12, { freq: 6000, gain: 0.1 }); tone(800, "sine", 0.1, { gain: 0.06, attack: 0.005 }); },
  pick() { tone(1200, "sine", 0.08, { gain: 0.15, attack: 0.005 }); tone(1600, "sine", 0.06, { gain: 0.1, attack: 0.02 }); },
  place() { tone(220, "triangle", 0.2, { gain: 0.3, attack: 0.01 }); noise(0.1, { freq: 1200, gain: 0.15 }); },
  click() { tone(700, "sine", 0.06, { gain: 0.1, attack: 0.005 }); },
  craft() { tone(523, "sine", 0.5, { gain: 0.15, attack: 0.02 }); tone(1047, "sine", 0.35, { gain: 0.08, attack: 0.22 }); },
  beam() { sweep(1200, 200, 0.35, { gain: 0.18 }); noise(0.3, { freq: 4000, gain: 0.12 }); },
  hit() { noise(0.15, { freq: 800, gain: 0.3 }); tone(120, "sine", 0.15, { gain: 0.25, attack: 0.005 }); },
  explosion() { noise(0.4, { freq: 500, gain: 0.3 }); tone(60, "sine", 0.4, { gain: 0.3, attack: 0.01 }); },
  power() { tone(300, "sawtooth", 0.2, { gain: 0.12 }); tone(450, "triangle", 0.2, { gain: 0.1, attack: 0.06 }); },
  win() { [523, 659, 784, 1047].forEach((f) => tone(f, "triangle", 0.6, { gain: 0.15, attack: 0.03 })); },
  lose() { [440, 349, 294, 220].forEach((f) => tone(f, "sawtooth", 0.8, { gain: 0.1, attack: 0.03 })); },
  error() { tone(200, "square", 0.15, { gain: 0.12 }); tone(150, "square", 0.2, { gain: 0.1, attack: 0.05 }); },
  notification() { tone(880, "sine", 0.3, { gain: 0.12, attack: 0.05 }); },
  switch() { tone(600, "sine", 0.08, { gain: 0.1 }); },
  tick() { tone(1000, "sine", 0.05, { gain: 0.08 }); },
  confirmation() { tone(600, "sine", 0.1, { gain: 0.1 }); tone(900, "sine", 0.1, { gain: 0.08, attack: 0.04 }); },
};

// Mute state persisted in localStorage.
let muted = false;
try {
  muted = localStorage.getItem("mobduel:muted") === "true";
} catch {}

// Build the public API — every name in FILES + ALIASES.
function makeSfx(name) {
  const file = resolve(name);
  return function play() {
    if (muted) return;
    if (!loaded) {
      loaded = true;
      preload();
    }
    if (file) playFile(file, name);
    else if (SYNTH[name]) SYNTH[name]();
  };
}

const API = {};
const ALL = new Set([...Object.keys(FILES), ...Object.keys(ALIASES)]);
for (const name of ALL) API[name] = makeSfx(name);

export const sfx = {
  ...API,

  /** Call on the first user gesture to unlock the AudioContext + preload. */
  unlock() {
    try {
      const c = getCtx();
      if (c && c.state === "suspended") c.resume();
      if (!loaded) {
        loaded = true;
        preload();
      }
    } catch {}
  },

  toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem("mobduel:muted", String(muted));
    } catch {}
    return muted;
  },

  isMuted() {
    return muted;
  },
};
