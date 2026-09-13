"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../sharedComponents/Header";
import LobbyHeader from "./LobbyHeader";
import PlayerGrid from "./PlayerGrid";
import StartButton from "./StartButton";
import PlayerCard from "./PlayerCard";
import { getSocket } from "../../lib/socket";
import lobby from "../../lib/lobby";
import { getStoredPlayer } from "../../lib/auth";
import { apiBase } from "../../lib/server";
import styles from "./LobbyScreen.module.css";

const MAX_SLOTS = 2;

export default function LobbyScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(lobby.getState());

  const resync = useCallback(async () => {
    const snap = lobby.getState();
    if (!snap.code) return;
    try {
      const res = await fetch(`${apiBase()}/rooms/${snap.code}`);
      if (!res.ok) return;
      const data = await res.json();
      lobby.setSnapshot(data, snap.isHost);
      setSnapshot(lobby.getState());
    } catch {
      // ignore resync failure; socket events will still apply
    }
  }, []);

  const navigateToBattle = useCallback(() => {
    const players = lobby.getState().players;
    const p1 = players[0]?.name || "Player 1";
    const p2 = players[1]?.name || "Player 2";
    const params = new URLSearchParams();
    params.set("p1", p1);
    params.set("p2", p2);
    router.push(`/battle?${params.toString()}`);
  }, [router]);

  useEffect(() => {
    const socket = getSocket();

    const applyPlayers = (players) => {
      console.log("[lobby] room:players", JSON.stringify(players));
      lobby.update({ players });
      setSnapshot(lobby.getState());
    };
    const onJoined = (data) => {
      console.log("[lobby] room:joined", JSON.stringify(data));
      lobby.setSnapshot(data, snapshot.isHost);
      setSnapshot(lobby.getState());
    };
    const onMatchStarted = () => {
      console.log("[lobby] match:started");
      navigateToBattle();
    };
    socket.on("room:players", applyPlayers);
    socket.on("room:joined", onJoined);
    socket.on("match:started", onMatchStarted);

    const unsubscribe = lobby.subscribe((next) => setSnapshot(next));

    const snap = lobby.getState();
    console.log("[lobby] mount snapshot", JSON.stringify(snap));

    const rejoin = () => {
      if (!snap.code) return;
      const player = getStoredPlayer();
      const playerName = player?.name || "Guest";
      socket.emit("room:join", { code: snap.code, playerName });
    };

    const timer = setTimeout(() => {
      resync();
      rejoin();
    }, 0);

    return () => {
      socket.off("room:players", applyPlayers);
      socket.off("room:joined", onJoined);
      socket.off("match:started", onMatchStarted);
      unsubscribe();
      clearTimeout(timer);
    };
  }, [snapshot.isHost, resync, navigateToBattle]);

  const handleStart = () => {
    const socket = getSocket();
    if (snapshot.roomId) {
      socket.emit("match:start", { roomId: snapshot.roomId });
    } else {
      navigateToBattle();
    }
  };

  const code = snapshot.code ? snapshot.code.split("") : [];
  const playerCount = snapshot.players.length;

  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const player = snapshot.players[i];
    if (!player) return null;
    return {
      component: PlayerCard,
      props: {
        name: player.name,
        tag: player.isHost ? "HOST" : `SEAT ${player.seat}`,
        isHost: player.isHost,
        active: true,
      },
    };
  });

  return (
    <div className={styles.page}>
      <Header title="Mob Duel Junior" />

      <main className={styles.main}>
        <LobbyHeader
          code={code}
          playerCount={playerCount}
          isHost={snapshot.isHost}
        />
        <PlayerGrid slots={slots} />
        {snapshot.isHost && <StartButton onClick={handleStart} />}
      </main>
    </div>
  );
}
