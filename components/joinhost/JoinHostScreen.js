"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../sharedComponents/Header";
import BottomNav from "../sharedComponents/BottomNav";
import Hero from "./Hero";
import HostCard from "./HostCard";
import JoinCard from "./JoinCard";
import { getSocket } from "../../lib/socket";
import lobby from "../../lib/lobby";
import { getStoredPlayer } from "../../lib/auth";
import styles from "./JoinHostScreen.module.css";

export default function JoinHostScreen() {
  const router = useRouter();
  const [error, setError] = useState(null);

  const handleCreateRoom = useCallback(() => {
    setError(null);
    const player = getStoredPlayer();
    const hostName = player?.name || "Captain";
    const socket = getSocket();
    const onJoined = (snapshot) => {
      lobby.setSnapshot(snapshot, true);
      socket.off("room:joined", onJoined);
      router.push("/lobby");
    };
    socket.on("room:joined", onJoined);
    socket.emit("room:create", { hostName });
  }, [router]);

  const handleJoinRoom = useCallback(
    (code) => {
      setError(null);
      const player = getStoredPlayer();
      const playerName = player?.name || "Guest";
      const socket = getSocket();

      const onJoined = (snapshot) => {
        lobby.setSnapshot(snapshot, false);
        socket.off("room:joined", onJoined);
        router.push("/lobby");
      };
      const onError = (message) => {
        socket.off("room:joined", onJoined);
        setError(message);
      };
      socket.on("room:joined", onJoined);
      socket.on("error", onError);
      socket.emit("room:join", { code, playerName });
    },
    [router]
  );

  return (
    <div className={styles.page}>
      <Header title="Mob Duel" accent="Junior" />

      <main className={styles.main}>
        <Hero
          title="Find Your Friends!"
          subtitle="Get ready for your next mission! Host a new room for your team or join an existing one using a secret code."
        />

        <div className={styles.grid}>
          <HostCard onCreateRoom={handleCreateRoom} />
          <JoinCard onJoin={handleJoinRoom} error={error} />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
