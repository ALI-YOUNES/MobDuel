"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MobileTopBar from "./MobileTopBar";
import SideNav from "./SideNav";
import OpponentZone from "./OpponentZone";
import PlayerZone from "./PlayerZone";
import VsDivider from "./VsDivider";
import BottomNav from "./BottomNav";
import SacrificeTable from "./SacrificeTable";
import FullscreenButton from "./FullscreenButton";
import CardModal from "../sharedComponents/CardModal";
import Card from "../sharedComponents/Card";
import { getSocket } from "../../lib/socket";
import lobby from "../../lib/lobby";
import { getStoredPlayer } from "../../lib/auth";
import { cardImageUrl } from "../../lib/cards";
import { apiBase } from "../../lib/server";
import { CARDS } from "../sharedComponents/cardData";
import { sfx } from "../../lib/sounds";
import styles from "./BattleScreen.module.css";

function makeCard(type, id) {
  const base = CARDS.find((c) => c.Type === type);
  return { ...base, id };
}

function powerOf(card) {
  if (!card) return 0;
  const p = typeof card.Power === "number" ? card.Power : Number(card.Power);
  return Number.isFinite(p) ? p : 0;
}

// Convert a backend CardInstance { id, uid, name, type, power, description }
// into the shape the Card component expects (uppercase keys + bgImage).
function toDisplayCard(inst) {
  if (!inst) return null;
  return {
    id: inst.uid,
    uid: inst.uid,
    Name: inst.name,
    Power: inst.power === null || inst.power === undefined ? "?" : inst.power,
    Type: inst.type,
    Description: inst.description,
    bgImage: cardImageUrl(inst.type, inst.name),
  };
}

// Convert the backend board { active: [], defense: [] } (parallel arrays) into
// the column slot array [{ active, defense }] the zone components expect.
function boardToSlots(board) {
  const active = board?.active || [];
  const defense = board?.defense || [];
  return Array.from({ length: Math.max(BOARD_SIZE, active.length) }, (_, i) => ({
    active: toDisplayCard(active[i]) || null,
    defense: toDisplayCard(defense[i]) || null,
  })).slice(0, BOARD_SIZE);
}

// An enemy slot is attacked via its resolving card: if it has a defending
// card the target is auto-changed to that defender; otherwise (active with no
// defense) the target is the active card.
function resolveTarget(slot) {
  if (slot && slot.defense) return { card: slot.defense, line: "defense" };
  if (slot && slot.active) return { card: slot.active, line: "active" };
  return null;
}

const BOARD_SIZE = 6;

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => ({ active: null, defense: null }));
}

// Build a 25-card deck per the game's deck structure:
// 1 Boss, 8 Common, 5 Elite, 6 Legendary, 5 Rare. (Temporary generator until
// the engine is wired to the backend catalog.) Returns shuffled instances.
let deckSeq = 1;
function buildDeck() {
  const layout = [
    ["BOSS", 1],
    ["COMMON", 8],
    ["ELITE", 5],
    ["LEGENDARY", 6],
    ["RARE", 5],
  ];
  const deck = [];
  for (const [type, n] of layout) {
    for (let i = 0; i < n; i++) {
      deck.push(makeCard(type, deckSeq++));
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const PHASE_ORDER = ["anomaly", "summon", "move"];

// How each Rare/anomaly card is played: how many board targets it needs, which
// board(s) may be targeted, and which visual FX to show while it resolves.
//   scope: 'none' | 'self' (own board) | 'opp' (opponent board) | 'any' (both)
const RARE_CONF = {
  "Spyglass": { targets: 0, scope: "none", fx: "peek" },
  "Mob Swap": { targets: 2, scope: "any", fx: "swap" },
  "Trap": { targets: 1, scope: "self", fx: "trap", noBoss: true },
  "The Void": { targets: 1, scope: "opp", fx: "void", eliteOnly: true },
  "Unstable Power": { targets: 1, scope: "any", fx: "power" },
  "Mutation": { targets: 1, scope: "any", fx: "power" },
  "Lightning Strike": { targets: 1, scope: "any", fx: "lightning" },
  "Respawn": { targets: 0, scope: "none", fx: "respawn" },
  "Totem of Undying": { targets: 1, scope: "self", fx: "totem" },
  "TNT": { targets: 2, scope: "any", fx: "tnt", adjacent: true },
  "Invisibility Potion": { targets: 1, scope: "self", fx: "invisible" },
};

// Are two board targets adjacent (same board)? Mirrors the backend rule for TNT.
function adjacentSlots(a, b) {
  if (!a || !b || a.owner !== b.owner) return false;
  if (a.index === b.index && a.line !== b.line) return true;
  if (a.line === b.line && Math.abs(a.index - b.index) === 1) return true;
  if (Math.abs(a.index - b.index) === 1 && a.line !== b.line) return true;
  return false;
}

// Translate a backend FX event into a map of slotKey -> overlay kind for the
// transient per-slot animation. The overlay names mirror the EffectOverlay
// kinds already supported by BattleSlot (`lightning`, `void`, `trap`, ...).
function buildFxOverlay(ev) {
  const out = {};
  const place = (slot) => {
    if (!slot) return;
    out[`${slot.owner}-${slot.line}-${slot.index}`] = ev.kind;
  };
  if (Array.isArray(ev.targets)) {
    for (const t of ev.targets) place(t);
  } else {
    place(ev.to);
    place(ev.from);
  }
  return out;
}

// A full-viewport laser beam connecting an attacker slot to its target slot.
// Both slots carry a `data-slot="owner-line-index"` attribute in the acting
// player's perspective, so we can measure their on-screen centers.
function FxBeamLayer({ fxBeam }) {
  const [pts, setPts] = useState(null);
  useEffect(() => {
    if (!fxBeam) {
      setPts(null);
      return;
    }
    const read = (slot) => {
      const el = slot ? document.querySelector(`[data-slot="${slot.owner}-${slot.line}-${slot.index}"]`) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    const a = read(fxBeam.from);
    const b = read(fxBeam.to);
    if (a && b) setPts({ ax: a.x, ay: a.y, bx: b.x, by: b.y, key: fxBeam.key });
    else setPts(null);
  }, [fxBeam]);
  if (!pts) return null;
  const dx = pts.bx - pts.ax;
  const dy = pts.by - pts.ay;
  const len = Math.hypot(dx, dy) || 1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  // The beam is a centered line, so anchor it at the MIDPOINT between the two
  // slots; its half-length then extends exactly from attacker to target.
  const mx = (pts.ax + pts.bx) / 2;
  const my = (pts.ay + pts.by) / 2;
  return (
    <div className={styles.fxLayer} key={pts.key}>
      <div
        className={styles.laserBeam}
        style={{
          left: mx,
          top: my,
          width: len,
          transform: `translate(-50%, -50%) rotate(${ang}deg)`,
        }}
      />
      <div className={`${styles.hitFlash} ${styles.hitEnemy}`} style={{ left: pts.bx, top: pts.by }} />
    </div>
  );
}

function DealCard({ index, player, card, onDone }) {  const toTop = player === "p2"; // Player 1 (bottom zone), Player 2 (top zone)
  const spread = 34;
  const x = (index % 9) * spread - spread * 4;
  const rot = (index % 7) - 3;
  const y = toTop ? -34 : 34;
  return (
    <div
      className={`${styles.dealFrame} ${toTop ? styles.dealToTop : styles.dealToBottom}`}
      style={{ animationDelay: `${index * 0.035}s`, "--deal-x": `${x}px`, "--deal-y": `${y}vh`, "--deal-r": `${rot}deg` }}
      onAnimationEnd={(e) => {
        if (e.animationName.includes("deal")) onDone?.();
      }}
    >
      <div className={styles.dealCard}>
        <Card Name={card.Name} Power={card.Power} Type={card.Type} bgImage={card.bgImage} Description={card.Description} compact />
      </div>
    </div>
  );
}

export default function BattleScreen() {
  const router = useRouter();
  const [dealing, setDealing] = useState(true);
  const [phase, setPhase] = useState(null);
  const [handMode, setHandMode] = useState("summon");
  const [handOpen, setHandOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [sacrificeOpen, setSacrificeOpen] = useState(false);
  const [craftResult, setCraftResult] = useState(null);
  const [playerBoard, setPlayerBoard] = useState(emptyBoard);
  const [opponentBoard, setOpponentBoard] = useState(emptyBoard);
  const [hand, setHand] = useState(buildDeck);
  const [deckP1, setDeckP1] = useState(buildDeck);
  const [deckP2, setDeckP2] = useState(buildDeck);

  const [attackMode, setAttackMode] = useState(false);
  const [attacker, setAttacker] = useState(null);
  const [attackCooldown, setAttackCooldown] = useState(0); // own-side turns left before you may attack

  const [moveMode, setMoveMode] = useState(false);
  const [moveFrom, setMoveFrom] = useState(null); // { index, line: 'active'|'defense' }
  const [previewCard, setPreviewCard] = useState(null);
  const [anomalyCard, setAnomalyCard] = useState(null); // armed RARE awaiting targets
  const [anomalySel, setAnomalySel] = useState([]); // [{owner,line,index}]
  const [anomalyError, setAnomalyError] = useState("");
  const [effects, setEffects] = useState({}); // state.cardEffects (uid -> effect)
  const [peekCards, setPeekCards] = useState(null); // opponent hand shown by Spyglass
  const [win, setWin] = useState(false);
  const [lose, setLose] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [errorNote, setErrorNote] = useState(null);
  const errorTimerRef = useRef(null);
  const [myId, setMyId] = useState(null);
  const [oppId, setOppId] = useState(null);
  const [myTurn, setMyTurn] = useState(false);
  const [ready, setReady] = useState(false); // authoritative state received
  const [myStatus, setMyStatus] = useState("");
  const [oppStatus, setOppStatus] = useState("");
  const leftRoomRef = useRef(false);
  const mountedRef = useRef(false);
  const roomIdRef = useRef(null);
  const socketStateRef = useRef(null); // latest authoritative MatchState
  const myIdRef = useRef(null);
  const oppIdRef = useRef(null);
  const prevMyTurnRef = useRef(false);
  const [fxQueue, setFxQueue] = useState([]); // [[{kind,from,to,targets,owner}, id]]
  const [fxBeam, setFxBeam] = useState(null); // {from,to}
  const [fxOverlays, setFxOverlays] = useState({}); // slotKey -> kind (transient)

  const canEndTurn = myTurn && phase === "done";

  // Auto-navigate back to the Welcome screen 5 seconds after a win or a loss.
  useEffect(() => {
    if (!win && !lose) return;
    setErrorNote(null);
    const t = setTimeout(() => router.push("/welcome"), 5000);
    return () => clearTimeout(t);
  }, [win, lose, router]);

  // Unlock the AudioContext on the first user gesture (browsers block audio
  // until then). Subsequent sounds play immediately.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Safety fallback: always dismiss the deal animation even if animation
  // end events are missed (e.g. reduced-motion or tab switching).
  useEffect(() => {
    if (!dealing) return;
    sfx.deal();
    const t = setTimeout(() => setDealing(false), 3400);
    return () => clearTimeout(t);
  }, [dealing]);

  // Socket handling: detect when the opponent leaves (room drops below 2
  // players) and surface the "Game Aborted" state. Room membership persists
  // across SPA navigation (same socket), and on a hard refresh the opponent's
  // disconnect notifies us via room:players. When this screen unmounts (the
  // current player navigates away), emit room:leave so the opponent is
  // notified the same way.
  useEffect(() => {
    const snap = lobby.getState();
    const roomId = snap.roomId;
    console.log("[battle] mount", { roomId, connected: getSocket().connected, snap });
    if (!roomId) return;

    const socket = getSocket();
    // React StrictMode (enabled in dev) runs mount -> cleanup -> mount on the
    // first render. We must NOT emit room:leave during that immediate cleanup,
    // or entering the battle aborts the game for everyone. Only mark the battle
    // as truly mounted once this tick settles; a real unmount (player navigating
    // away) happens later and will then emit room:leave.
    mountedRef.current = false;
    const settle = setTimeout(() => {
      mountedRef.current = true;
    }, 0);

    const onRoomPlayers = (players) => {
      console.log("[battle] room:players", players && players.length, JSON.stringify(players));
      if (!players || players.length < 2) {
        setAborted(true);
      }
    };
    const onAbort = () => {
      console.log("[battle] room:abort");
      setAborted(true);
    };
    const onError = (err) => {
      // Action/validation errors ("Not strong enough...", attack cooldown,
      // etc.) are NOT match-aborting: surface them as a banner so the game
      // keeps going. Only room membership / socket-level falls actually abort.
      console.log("[battle] socket error", err);
      const msg = typeof err === "string" && err ? err : "Something went wrong.";
      setErrorNote(msg);
      sfx.error();
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = window.setTimeout(() => setErrorNote(null), 4000);
    };
    socket.on("room:players", onRoomPlayers);
    socket.on("room:abort", onAbort);
    socket.on("error", onError);

    return () => {
      clearTimeout(settle);
      window.clearTimeout(errorTimerRef.current);
      socket.off("room:players", onRoomPlayers);
      socket.off("room:abort", onAbort);
      socket.off("error", onError);
      if (mountedRef.current && !leftRoomRef.current) {
        leftRoomRef.current = true;
        socket.emit("room:leave", { roomId });
      }
    };
  }, []);

  // Fallback presence signaling that works even without the backend socket:
  // two battle tabs in the same browser communicate leave/refresh over a
  // BroadcastChannel scoped to the room. When this tab hides/reloads it posts
  // an abort; the other tab reacts and shows "Game Aborted". This complements
  // the socket room:players path.
  useEffect(() => {
    const snap = lobby.getState();
    const roomId = snap.roomId;
    if (!roomId || typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(`mobduel:abort:${roomId}`);
    const onMessage = (event) => {
      if (event.data && event.data.abort) setAborted(true);
    };
    channel.addEventListener("message", onMessage);

    const onHide = () => {
      try {
        channel.postMessage({ abort: true });
      } catch {
        // channel may be closed already
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      channel.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      try {
        channel.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // TEST ONLY: press Q to trigger the lose effect (remove this later).
  useEffect(() => {
    function onKey(e) {
      if (e.key.toLowerCase() === "q") setLose(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function advance() {
    setPhase((prev) => {
      if (!prev) return null;
      const idx = PHASE_ORDER.indexOf(prev);
      if (idx === -1) return "done";
      return idx === PHASE_ORDER.length - 1 ? "done" : PHASE_ORDER[idx + 1];
    });
  }

  // Apply an authoritative MatchState (from REST fetch or match:state socket
  // event) to the local board/hand/turn derived state.
  function applyMatchState(state) {
    socketStateRef.current = state;
    if (!state) return;
    const pid = myIdRef.current;
    const oid = oppIdRef.current;
    if (!pid || !oid) return;

    setPlayerBoard(boardToSlots(state.boards?.[pid]) || emptyBoard());
    setOpponentBoard(boardToSlots(state.boards?.[oid]) || emptyBoard());
    setHand((state.hands?.[pid] || []).map(toDisplayCard));

    setCraftResult(state.craftResults?.[pid] ? toDisplayCard(state.craftResults[pid]) : null);
    setMyStatus(state.status?.[pid] || "");
    setOppStatus(state.status?.[oid] || "");
    setEffects(state.cardEffects || {});

    const isMyTurn = state.currentPlayerId === pid && !state.winnerId;
    setMyTurn(isMyTurn);
    setReady(true);

    // Anti-spam: after attacking you must wait 2 of your own turns.
    const cd = state.attackCooldown?.[pid] || 0;
    setAttackCooldown(cd);
    if (cd > 0 && isMyTurn) {
      setAttackMode(false);
      setAttacker(null);
      sfx.cooldown();
    }

    // Open the turn bar when the turn flips to us; close it when it flips away.
    if (prevMyTurnRef.current === false && isMyTurn) {
      sfx.turnStart();
      setPhase("anomaly");
    }
    if (prevMyTurnRef.current === true && !isMyTurn) {
      setPhase(null);
      setHandOpen(false);
      setSelectedCard(null);
      setCraftResult(null);
      setAnomalyCard(null);
      setAnomalySel([]);
      setPeekCards(null);
    }
    prevMyTurnRef.current = isMyTurn;

    if (state.winnerId) {
      if (state.winnerId === pid) {
        setWin(true);
        sfx.win();
      } else {
        setLose(true);
        sfx.lose();
      }
    }
  }

  // Resolve who we are in the match and follow the authoritative match state
  // (initial REST fetch + live match:state updates). The backend deck/hand is
  // the single source of truth shared across both PCs.
  useEffect(() => {
    const snap = lobby.getState();
    const roomId = snap.roomId;
    roomIdRef.current = roomId;
    if (!roomId) return;

    const members = snap.players || [];
    const me = getStoredPlayer();
    const myMember =
      members.find((p) => p.id === me?.id) ||
      members.find((p) => p.name === me?.name) ||
      members[0];
    const opp = members.find((p) => p.id !== myMember?.id) || members[1] || null;
    myIdRef.current = myMember?.id || null;
    oppIdRef.current = opp?.id || null;
    setMyId(myIdRef.current);
    setOppId(oppIdRef.current);

    const socket = getSocket();
    const handleState = (state) => applyMatchState(state);
    const handleFx = (payload) => {
      const events = payload && payload.fx ? payload.fx : [];
      if (!events.length) return;
      // FX slots are expressed in the ACTING player's perspective. Translate
      // them into the local viewer's perspective so the laser / portal lands
      // on the correct zone on every screen.
      const viewer = myIdRef.current;
      const localize = (e) => {
        const map = (slot) => {
          if (!slot) return slot;
          const same = e.actor === viewer;
          return { ...slot, owner: same ? slot.owner : slot.owner === "self" ? "opponent" : "self" };
        };
        return {
          ...e,
          from: map(e.from),
          to: map(e.to),
          targets: e.targets ? e.targets.map(map) : e.targets,
        };
      };
      setFxQueue((q) => [
        ...q,
        ...events.map((raw) => {
          const e = localize(raw);
          return { e, id: Date.now() + Math.random(), key: `${e.kind}-${Date.now()}-${Math.random()}` };
        }),
      ]);
    };
    const handleStarted = (started) => {
      if (started?.state) applyMatchState(started.state);
    };
    socket.on("match:state", handleState);
    socket.on("match:fx", handleFx);
    socket.on("match:started", handleStarted);

    fetch(`${apiBase()}/matches/room/${roomId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((match) => {
        if (match?.state) applyMatchState(match.state);
      })
      .catch(() => {});

    return () => {
      socket.off("match:state", handleState);
      socket.off("match:fx", handleFx);
      socket.off("match:started", handleStarted);
    };
  }, []);

  // Drain the visual FX queue one event at a time so laser beams / void
  // portals / trap detonations play in order on BOTH players' screens.
  const FX_SOUND = {
    attack: "beam",
    trap: "trap",
    void: "void",
    lightning: "lightning",
    tnt: "tnt",
    boom: "boom",
    swap: "swap",
    totem: "totem",
    power: "power",
    invisible: "invisible",
    respawn: "respawn",
    peek: "peek",
  };
  useEffect(() => {
    if (!fxQueue.length) return;
    const current = fxQueue[0];
    const kind = current.e.kind;
    if (kind === "attack") {
      setFxBeam({ from: current.e.from, to: current.e.to, key: current.key });
    } else {
      setFxOverlays(buildFxOverlay(current.e));
    }
    const snd = FX_SOUND[kind];
    if (snd && sfx[snd]) sfx[snd]();
    const t = setTimeout(() => {
      setFxBeam(null);
      setFxOverlays({});
      setFxQueue((q) => q.slice(1));
    }, 750);
    return () => clearTimeout(t);
  }, [fxQueue]);

  // Tell the backend which phase we entered so the opponent sees a status
  // message. Only meaningful while it is our turn.
  function emitPhase(phase, verb) {
    if (!myTurn) return;
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "phase",
      data: { playerId: myIdRef.current, phase, verb },
    });
  }

  // ── Anomaly ──
  function onAnomaly(use) {
    if (use) {
      sfx.handOpen();
      setHandMode("anomaly");
      setHandOpen(true);
    } else {
      emitPhase("anomaly", "skip");
      advance();
    }
  }

  // ── Hand (anomaly / summon / view) ──
  function onHandPick(card, mode) {
    sfx.pick();
    if (mode === "anomaly") {
      setHandOpen(false);
      const conf = RARE_CONF[card.Name];
      if (!conf) {
        setAnomalyError(`"${card.Name}" is not implemented yet.`);
        setTimeout(() => setAnomalyError(""), 1800);
        return;
      }
      setAnomalyCard(card);
      setAnomalySel([]);
      if (conf.targets === 0) {
        // Zero-target anomalies (Spyglass peek, Respawn) resolve immediately.
        resolveAnomaly(card, [], conf);
      }
      return;
    }
    if (mode === "view") {
      setHandOpen(false);
      return;
    }
    setSelectedCard(card);
    setHandOpen(false);
  }

  // Emit a `useRare` action for the armed anomaly. Its visual FX is driven by
  // the server's `match:fx` broadcast so BOTH players see the same animation.
  function resolveAnomaly(card, targets, conf) {
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "useRare",
      data: {
        playerId: myIdRef.current,
        cardUid: card.uid,
        targets: targets.map((t) => ({ kind: "board", owner: t.owner, line: t.line, index: t.index })),
      },
    });
    // Spyglass reveals the opponent's hand to us only.
    if (card.Name === "Spyglass") {
      const state = socketStateRef.current;
      const oppHand = state?.hands?.[oppIdRef.current] || [];
      setPeekCards(oppHand.map(toDisplayCard));
    }
    setTimeout(() => {
      setAnomalyCard(null);
      setAnomalySel([]);
      advance();
    }, card.Name === "Spyglass" ? 250 : conf.fx && targets.length > 0 ? 900 : 250);
  }

  // Called by the zones when a valid anomaly target is clicked.
  function onAnomalyPick(owner, index, line) {
    if (!anomalyCard) return;
    const conf = RARE_CONF[anomalyCard.Name];
    if (!conf || conf.targets === 0) return;
    sfx.slot();
    const t = { owner, index, line };
    // Toggle off if already selected.
    if (anomalySel.some((s) => s.owner === owner && s.line === line && s.index === index)) {
      setAnomalySel(anomalySel.filter((s) => !(s.owner === owner && s.line === line && s.index === index)));
      return;
    }
    const next = [...anomalySel, t];
    if (conf.targets === 1) {
      setAnomalySel(next);
      resolveAnomaly(anomalyCard, next, conf);
    } else if (conf.targets === 2) {
      if (next.length === 2 && conf.adjacent && !adjacentSlots(next[0], next[1])) {
        setAnomalyError("TNT targets must be adjacent to each other.");
        setAnomalySel([]);
        setTimeout(() => setAnomalyError(""), 1600);
        return;
      }
      setAnomalySel(next);
      if (next.length === 2) resolveAnomaly(anomalyCard, next, conf);
    }
  }

  function cancelAnomaly() {
    setAnomalyCard(null);
    setAnomalySel([]);
    setAnomalyError("");
  }

  // Persistent effect badges for a boarded card (Trap/Totem/Invisibility/next power).
  function badgesFor(card, who) {
    if (!card) return undefined;
    const e = effects[card.uid];
    if (!e) return undefined;
    const list = [];
    // The trap is secret: only the card owner may see the trap badge.
    if (e.trap && who === "self") list.push({ key: "trap", icon: "warning", label: "Trap" });
    if (e.totem) list.push({ key: "totem", icon: "auto_awesome", label: "Totem" });
    if (e.untargetable) list.push({ key: "untargetable", icon: "visibility_off", label: "Invisible" });
    return list.length ? list : undefined;
  }

  // Valid anomaly targets for a given board, based on the armed card.
  function anomalyValidFor(zoneBoard, ownerScope) {
    if (!anomalyCard) return null;
    const conf = RARE_CONF[anomalyCard.Name];
    if (!conf) return null;
    const allowed =
      conf.scope === "any" ||
      (ownerScope === "self" && conf.scope === "self") ||
      (ownerScope === "opp" && conf.scope === "opp");
    if (!allowed) return [];
    const res = [];
    zoneBoard.forEach((slot, index) => {
      for (const line of ["active", "defense"]) {
        const c = slot[line];
        if (!c) continue;
        if (conf.noBoss && c.Type === "BOSS") continue;
        if (conf.eliteOnly && !(c.Type === "COMMON" || c.Type === "ELITE")) continue;
        res.push({ index, line });
      }
    });
    return res;
  }

  const anomalyValidSelf = anomalyValidFor(playerBoard, "self");
  const anomalyValidOpp = anomalyValidFor(opponentBoard, "opp");
  const anomalyKs = anomalySel ? anomalySel.filter((s) => s.owner === "self") : [];
  const anomalyKo = anomalySel ? anomalySel.filter((s) => s.owner === "opponent") : [];

  // Current transient FX overlays, split by zone ownership (OpponentZone uses
  // owner "opponent"; PlayerZone uses owner "self").
  const fxKindList = () => {
    const list = [];
    for (const [k, kind] of Object.entries(fxOverlays)) {
      const [owner, line, index] = k.split("-");
      list.push({ owner, line, index: Number(index), name: kind });
    }
    return list;
  };
  const fxKindsSelf = fxKindList().filter((f) => f.owner === "self");
  const fxKindsOpp = fxKindList().filter((f) => f.owner === "opponent");

  function onPlace(index) {
    const card = craftResult || selectedCard;
    if (!card) return;
    if (card.Type === "RARE") return; // RAREs can't be placed on the board
    const isCraft = !!craftResult;
    // Send the summon to the backend; it persists the state and re-broadcasts
    // match:state to both players so the card also appears on the opponent PC.
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "place",
      data: { playerId: myIdRef.current, index, cardUid: card.uid, craft: isCraft },
    });
    sfx.place();
    if (card.Type === "BOSS") sfx.win();
    setCraftResult(null);
    setSelectedCard(null);
    // Advance the local phase UI (the board itself updates from match:state).
    advance();
  }

  function openSummon() {
    emitPhase("summon_choose");
    sfx.handOpen();
    setHandMode("summon");
    setHandOpen(true);
  }

  // Show the full hand (no COMMON/RARE filter).
  function viewHand() {
    sfx.handOpen();
    setHandMode("view");
    setHandOpen(true);
  }

  // ── Sacrifice / Craft ──
  function openSacrifice() {
    emitPhase("sacrifice");
    sfx.handOpen();
    setSacrificeOpen(true);
  }

  function onCraft(recipe, fuelSel, reward) {
    // Send the sacrifice to the backend; it validates, consumes the fuel,
    // holds the reward pending placement, and re-broadcasts match:state.
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "sacrifice",
      data: {
        playerId: myIdRef.current,
        recipeId: recipe.id,
        rewardUid: reward.uid,
        fuel: fuelSel.map((f) => ({ index: f.index, line: f.line })),
      },
    });
    sfx.craft();
    setSacrificeOpen(false);
  }

  // ── Change hand ──
  function onChangeHand() {
    // Discard the current hand and redraw 5 from the deck (backend-authoritative).
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "changeHand",
      data: { playerId: myIdRef.current },
    });
    sfx.changeHand();
    advance();
  }

  // ── Attack ──
  const attackableAttackers = playerBoard
    .map((slot, idx) => (slot.active && powerOf(slot.active) > 0 ? idx : null))
    .filter((i) => i !== null);

  const validTargets = attacker
    ? opponentBoard
        .map((slot, idx) => {
          const tgt = resolveTarget(slot);
          if (!tgt) return null;
          if (effects[tgt.card.uid]?.untargetable) return null;
          if (!(powerOf(attacker.card) > powerOf(tgt.card))) return null;
          return idx;
        })
        .filter((i) => i !== null)
    : [];

  function toggleAttack() {
    if (attackCooldown > 0) return;
    setAttackMode((prev) => {
      sfx.attackToggle();
      return !prev;
    });
    setAttacker(null);
  }

  function onAttackerPick(idx) {
    if (!attackMode) return;
    sfx.attackerPick();
    setAttacker({ slotIdx: idx, card: playerBoard[idx].active });
  }

  function onTargetPick(idx) {
    if (!attacker || !validTargets.includes(idx)) return;
    setAttacker(null);
    setAttackMode(false);
    sfx.beam();
    // Send the attack to the backend; it removes the target and re-broadcasts
    // match:state + match:fx so both players see the laser and result.
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "attack",
      data: { playerId: myIdRef.current, attackerIndex: attacker.slotIdx, targetIndex: idx },
    });
    setTimeout(() => {
      advance();
    }, 400);
  }

  // ── Move ──
  function toggleMove() {
    setMoveMode((prev) => {
      if (!prev) {
        emitPhase("move");
        sfx.move();
      }
      return !prev;
    });
    setMoveFrom(null);
  }

  // Skipping the Move phase still narrates it to the opponent.
  function skipMove() {
    emitPhase("move", "skip");
    advance();
  }

  function onMoveFrom(index, line) {
    if (!moveMode) return;
    sfx.pick();
    setMoveFrom({ index, line });
  }

  function onMovePlace(toIndex) {
    if (!moveFrom) return;
    const { index, line } = moveFrom;
    const card = line === "active" ? playerBoard[index].active : playerBoard[index].defense;
    if (!card) return;

    // Send the move to the backend; it applies the same rules and re-broadcasts
    // match:state so both players see the moved card.
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "move",
      data: { playerId: myIdRef.current, fromIndex: index, toIndex, line },
    });
    sfx.place();
    setMoveMode(false);
    setMoveFrom(null);
    advance();
  }

  // ── End turn ──
  function onEndTurn() {
    // Tell the backend the turn is over; it refills the hand and passes the
    // turn (the match:state update flips both players' turn bars).
    getSocket().emit("match:action", {
      roomId: roomIdRef.current,
      action: "endTurn",
      data: {},
    });
    sfx.endTurn();
    // Close local UI immediately; the authoritative state confirms shortly after.
    setPhase(null);
    setHandOpen(false);
    setSelectedCard(null);
    setCraftResult(null);
    setAttackMode(false);
    setAttacker(null);
    setMoveMode(false);
    setMoveFrom(null);
  }

  return (
    <div className={styles.page}>
      <MobileTopBar />
      <FullscreenButton />

      <div className={styles.body}>
        <SideNav
          phase={phase}
          canEndTurn={canEndTurn}
          onAnomaly={onAnomaly}
          onSummon={openSummon}
          onSacrifice={openSacrifice}
          onAttack={toggleAttack}
          attackActive={attackMode}
          attackCooldown={attackCooldown}
          onChangeHand={onChangeHand}
          onMove={toggleMove}
          onSkipMove={skipMove}
          onEndTurn={onEndTurn}
          onViewHand={viewHand}
          myTurn={myTurn}
          ready={ready}
        />

        <main className={styles.main}>
          <div className={`${styles.statusStrip} ${myTurn ? styles.myTurnStrip : styles.oppTurnStrip}`}>
            <span className={`material-symbols-outlined ${styles.statusIcon}`}>{myTurn ? "schedule" : "hourglass_empty"}</span>
            <span className={styles.statusText}>
              {myTurn ? (
                <>Your turn. {myStatus}</>
              ) : (
                <><strong>Opponent: </strong>{oppStatus || "waiting for the opponent..."}</>
              )}
            </span>
          </div>
          <div className={styles.battlefield}>
            <OpponentZone
              board={opponentBoard}
              targeting={attackMode && attacker}
              validTargets={validTargets}
              onTargetPick={onTargetPick}
              anomalyValid={anomalyValidOpp}
              anomalySel={anomalyKo}
              onAnomalyPick={(index, line) => onAnomalyPick("opponent", index, line)}
              fxKind={fxKindsOpp}
              badgesFor={(c) => badgesFor(c, "opp")}
              onLook={setPreviewCard}
            />
            <VsDivider />
            <PlayerZone
              board={playerBoard}
              hand={hand}
              handOpen={handOpen}
              handMode={handMode}
              placeTarget={!attackMode && !moveMode && (!!selectedCard || !!craftResult) && (selectedCard?.Type ?? craftResult?.Type) !== "RARE"}
              onHandPick={onHandPick}
              onCloseHand={() => setHandOpen(false)}
              onPlace={onPlace}
              attackMode={attackMode}
              attackerIdx={attacker && attacker.slotIdx}
              attackable={attackableAttackers}
              onAttackerPick={onAttackerPick}
              moveMode={moveMode}
              moveFrom={moveFrom}
              onMoveFrom={onMoveFrom}
              onMovePlace={onMovePlace}
              anomalyValid={anomalyValidSelf}
              anomalySel={anomalyKs}
              onAnomalyPick={(index, line) => onAnomalyPick("self", index, line)}
              fxKind={fxKindsSelf}
              badgesFor={(c) => badgesFor(c, "self")}
              onLook={setPreviewCard}
            />
          </div>
        </main>
      </div>

      {errorNote && (
        <div className={styles.errorBanner} role="alert">
          <span className={`material-symbols-outlined ${styles.anomalyIcon}`} style={{ fontSize: "20px" }}>error</span>
          <span className={styles.anomalyText}>
            <strong>Try again:</strong> {errorNote}
          </span>
          <button className={styles.anomalyCancel} onClick={() => setErrorNote(null)}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
        </div>
      )}

      {anomalyCard && (
        <div className={styles.anomalyBanner}>
          <span className={`material-symbols-outlined ${styles.anomalyIcon}`} style={{ fontSize: "20px" }}>auto_fix_high</span>
          <span className={styles.anomalyText}>
            <strong>{anomalyCard.Name}:</strong>{" "}
            {anomalyError
              ? anomalyError
              : `select ${RARE_CONF[anomalyCard.Name].targets} target${RARE_CONF[anomalyCard.Name].targets > 1 ? "s" : ""} on the board.`}
          </span>
          <button className={styles.anomalyCancel} onClick={cancelAnomaly}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
            Cancel
          </button>
        </div>
      )}

      {dealing && (
        <div className={styles.dealOverlay}>
          {deckP1.map((card, i) => (
            <DealCard key={`p1-${i}`} index={i} player="p1" card={card} onDone={i === deckP1.length - 1 ? () => setDealing(false) : undefined} />
          ))}
          {deckP2.map((card, i) => (
            <DealCard key={`p2-${i}`} index={i} player="p2" card={card} onDone={i === deckP2.length - 1 ? () => setDealing(false) : undefined} />
          ))}
        </div>
      )}

      <BottomNav onSacrifice={openSacrifice} />

      <SacrificeTable
        open={sacrificeOpen}
        boardSlots={playerBoard}
        hand={hand}
        onCraft={onCraft}
        onClose={() => setSacrificeOpen(false)}
        onLook={setPreviewCard}
      />

      <CardModal card={previewCard} onClose={() => setPreviewCard(null)} />

      {peekCards && (
        <div className={styles.peekOverlay} onClick={() => setPeekCards(null)}>
          <div className={styles.peekPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.peekHeader}>
              <span className={`material-symbols-outlined`} style={{ fontSize: "22px" }}>visibility</span>
              <h3>Spyglass Peek</h3>
              <button className={styles.anomalyCancel} onClick={() => setPeekCards(null)} aria-label="Close">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
              </button>
            </div>
            <p className={styles.peekSub}>The opponent&apos;s hand:</p>
            <div className={styles.peekRow}>
              {peekCards.map((c) => (
                <div key={c.uid} className={styles.peekCard} onClick={() => setPreviewCard(c)}>
                  <Card {...c} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {win && (
        <div className={styles.winOverlay}>
          <div className={styles.confetti}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className={styles.confettiPiece}
                style={{
                  left: `${(i * 4.3) % 100}%`,
                  animationDelay: `${(i % 10) * 0.2}s`,
                  background: ["#fdc003", "#0059bb", "#28a745", "#ba1a1a", "#fd7e14"][i % 5],
                }}
              />
            ))}
          </div>
          <div className={styles.winCard}>
            <span className="material-symbols-outlined" style={{ fontSize: "72px", color: "#fdc003", fontVariationSettings: "'FILL' 1" }}>military_tech</span>
            <h1 className={styles.winTitle}>Victory!</h1>
            <p className={styles.winSub}>You placed the Boss card.</p>
            <p className={styles.autoNav}>Returning to Welcome in 5s...</p>
            <button className={styles.winBtn} onClick={() => router.push("/welcome")}>
              Back to Home
            </button>
          </div>
        </div>
      )}

      {lose && (
        <div className={styles.loseOverlay}>
          <div className={styles.loseShards}>
            {Array.from({ length: 20 }).map((_, i) => (
              <span
                key={i}
                className={styles.loseShard}
                style={{
                  left: `${(i * 5.2) % 100}%`,
                  animationDelay: `${(i % 8) * 0.25}s`,
                  background: ["#ba1a1a", "#93000a", "#414754"][i % 3],
                }}
              />
            ))}
          </div>
          <div className={styles.loseCard}>
            <span className="material-symbols-outlined" style={{ fontSize: "72px", color: "#ba1a1a", fontVariationSettings: "'FILL' 1" }}>sports_score</span>
            <h1 className={styles.loseTitle}>Defeat</h1>
            <p className={styles.loseSub}>Your Boss was destroyed.</p>
            <p className={styles.autoNav}>Returning to Welcome in 5s...</p>
          </div>
        </div>
      )}

      {aborted && (
        <div className={styles.abortOverlay}>
          <div className={styles.abortCard}>
            <span className="material-symbols-outlined" style={{ fontSize: "80px", color: "#717786", fontVariationSettings: "'FILL' 1" }}>gpp_maybe</span>
            <h1 className={styles.abortTitle}>Game Aborted</h1>
            <p className={styles.abortSub}>One of the players left.</p>
            <button className={styles.abortBtn} onClick={() => router.push("/join-host")}>
              Go to Home
            </button>
          </div>
        </div>
      )}

      <FxBeamLayer fxBeam={fxBeam} />
    </div>
  );
}
