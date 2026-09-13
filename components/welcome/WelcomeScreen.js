"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./WelcomeScreen.module.css";
import { useAuthGuard } from "../../lib/useAuth";
import { getSocket } from "../../lib/socket";
import lobby from "../../lib/lobby";
import { getStoredPlayer } from "../../lib/auth";

const DIFFICULTIES = [
  { id: "EASY", label: "Easy", icon: "child_care", blurb: "Casual fun" },
  { id: "MEDIUM", label: "Medium", icon: "smart_toy", blurb: "Reasonable" },
  { id: "HARD", label: "Hard", icon: "military_tech", blurb: "Tough" },
  { id: "EXTRA_HARD", label: "Extra Hard", icon: "skull", blurb: "Nearly unbeatable" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { checking, player } = useAuthGuard();
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceError, setPracticeError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Listen for the practice match result: set up the lobby store from
  // `room:joined`, then jump straight into the battle when the match starts.
  useEffect(() => {
    const socket = getSocket();
    const onJoined = (snapshot) => {
      lobby.setSnapshot(snapshot, true);
      socket.off("room:joined", onJoined);
    };
    const onStarted = () => {
      socket.off("match:started", onStarted);
      socket.off("error", onError);
      router.push("/battle");
    };
    const onError = (message) => {
      setStarting(false);
      setPracticeError(message || "Could not start a practice match.");
    };
    socket.on("room:joined", onJoined);
    socket.on("match:started", onStarted);
    socket.on("error", onError);
    return () => {
      socket.off("room:joined", onJoined);
      socket.off("match:started", onStarted);
      socket.off("error", onError);
    };
  }, [router]);

  const startPractice = useCallback(
    (difficulty) => {
      setPracticeError(null);
      setStarting(true);
      const playerName = getStoredPlayer()?.name || "Captain";
      getSocket().emit("practice:create", { hostName: playerName, difficulty });
    },
    [],
  );

  if (checking || !player) return null;

  const name = player.name || "Player";
  const stats = player.stats || { gamesPlayed: 0, gamesWon: 0, winRate: 0 };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.playerInfo}>
            <div className={styles.playerName}>
              <span
                className="material-symbols-rounded"
                style={{ color: "#3d5afe" }}
              >
                face
              </span>
              {name}
            </div>
            <div className={styles.playerLevel}>Level 1 Player</div>
          </div>
          <div className={styles.headerDivider} />
          <div className={styles.headerTitleDesktop}>Mob Duel JR!</div>
        </div>
        <div className={styles.headerTitleMobile}>Mob Duel JR!</div>
        <button className={styles.helpBtn} aria-label="Help">
          <span className="material-symbols-rounded">help</span>
        </button>
      </header>

      <div className={styles.pageBody}>
        <main className={styles.main}>
          <div className={styles.mainInner}>
            <div className={styles.hero}>
              <h1 className={styles.heroTitle}>{"Let's Play!"}</h1>
              <p className={styles.heroSubtitle}>
                Get ready for fun! Pick your team and jump into the game.
              </p>
            </div>

            <div className={styles.actions}>
              <button className={styles.startBtn} onClick={() => router.push("/join-host")}>
                <span className="material-symbols-rounded" style={{ fontSize: "30px" }}>
                  sports_esports
                </span>
                Start Adventure!
              </button>
              <button className={styles.deckBtn} onClick={() => router.push("/deck")}>
                <span className="material-symbols-rounded" style={{ fontSize: "30px" }}>
                  style
                </span>
                View Deck
              </button>
              <button className={styles.practiceBtn} onClick={() => setPracticeOpen(true)}>
                <span className="material-symbols-rounded" style={{ fontSize: "30px" }}>
                  smart_toy
                </span>
                Practice vs Bot
              </button>
            </div>

            {practiceOpen && (
              <div className={styles.practiceBackdrop} onClick={() => { if (!starting) setPracticeOpen(false); }}>
                <div className={styles.practicePanel} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.practiceHead}>
                    <span className="material-symbols-rounded" style={{ fontSize: "28px", color: "#3d5afe" }}>smart_toy</span>
                    <div>
                      <h2 className={styles.practiceTitle}>Practice vs Bot</h2>
                      <p className={styles.practiceSub}>Pick a difficulty, then face the bot solo.</p>
                    </div>
                    {!starting && (
                      <button className={styles.practiceClose} onClick={() => setPracticeOpen(false)} aria-label="Close">
                        <span className="material-symbols-rounded">close</span>
                      </button>
                    )}
                  </div>

                  <div className={styles.diffGrid}>
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.id}
                        className={styles.diffCard}
                        disabled={starting}
                        onClick={() => startPractice(d.id)}
                      >
                        <span className={`${styles.diffIcon} material-symbols-rounded`}>{d.icon}</span>
                        <span className={styles.diffLabel}>{d.label}</span>
                        <span className={styles.diffBlurb}>{d.blurb}</span>
                      </button>
                    ))}
                  </div>

                  {starting && (
                    <p className={styles.practiceStatus}>
                      <span className={`material-symbols-rounded ${styles.practiceSpin}`}>progress_activity</span>
                      Starting match...
                    </p>
                  )}
                  {practiceError && <p className={styles.practiceError}>{practiceError}</p>}
                </div>
              </div>
            )}

            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={`${styles.statBg} ${styles.statBgYellow}`} />
                <span
                  className={`${styles.statIcon} ${styles.statIconYellow} material-symbols-rounded`}
                >
                  military_tech
                </span>
                <div className={styles.statLabel}>Games Played</div>
                <div className={styles.statValue}>{stats.gamesPlayed}</div>
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statBg} ${styles.statBgGreen}`} />
                <span
                  className={`${styles.statIcon} ${styles.statIconGreen} material-symbols-rounded`}
                >
                  emoji_events
                </span>
                <div className={styles.statLabel}>Games Won</div>
                <div className={styles.statValue}>{stats.gamesWon}</div>
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statBg} ${styles.statBgOrange}`} />
                <span
                  className={`${styles.statIcon} ${styles.statIconOrange} material-symbols-rounded`}
                >
                  monetization_on
                </span>
                <div className={styles.statLabel}>Win Rate</div>
                <div className={styles.statValue}>{stats.winRate}%</div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <nav className={styles.bottomNav}>
        <Link href="/welcome" className={`${styles.navItem} ${styles.navItemActive}`}>
          <span className={`${styles.navIcon} material-symbols-rounded`}>home</span>
          Home
        </Link>
        <Link href="/deck" className={styles.navItem}>
          <span className={`${styles.navIcon} material-symbols-rounded`}>style</span>
          Cards
        </Link>
        <a href="#" className={styles.navItem}>
          <span className={`${styles.navIcon} material-symbols-rounded`}>storefront</span>
          Shop
        </a>
        <a href="#" className={styles.navItem}>
          <span className={`${styles.navIcon} material-symbols-rounded`}>settings</span>
          Options
        </a>
      </nav>
    </div>
  );
}
