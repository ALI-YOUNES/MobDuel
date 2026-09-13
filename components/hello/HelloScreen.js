"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "../../lib/auth";
import { useGuestGuard } from "../../lib/useAuth";
import styles from "./HelloScreen.module.css";

export default function HelloScreen() {
  const router = useRouter();
  const { checking } = useGuestGuard();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleProceed = async () => {
    if (!name.trim() || !password) {
      setError("Enter a moniker and a password to get started.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { token, player } = await register(name.trim(), password);
      if (token) {
        const { setSession } = await import("../../lib/auth");
        setSession({ token, player });
      }
      router.push("/welcome");
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleProceed();
  };

  if (checking) return null;

  return (
    <div className={styles.page}>
      <div className={styles.backgroundLayer} />

      <header className={styles.header}>
        <div className={styles.headerTitle}>MOB DUEL JR!</div>
        <button className={styles.helpButton} aria-label="Help">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "30px", fontVariationSettings: "'FILL' 1" }}
          >
            help_center
          </span>
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.iconCircle}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "48px",
                  color: "var(--on-secondary)",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                smart_toy
              </span>
            </div>

            <h1 className={styles.heading}>Create Your Account!</h1>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="alias">
                Moniker
              </label>
              <input
                className={styles.input}
                id="alias"
                type="text"
                placeholder="Enter Moniker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="username"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="password">
                Password
              </label>
              <input
                className={styles.input}
                id="password"
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="new-password"
              />
            </div>

            <button
              className={styles.proceedButton}
              onClick={handleProceed}
              disabled={loading}
            >
              <span>{loading ? "CREATING..." : "CREATE ACCOUNT"}</span>
            </button>

            <div className={styles.switch}>
              <span>Already have an account?</span>
              <Link href="/login" className={styles.switchLink}>
                Log in here
              </Link>
            </div>

            <div className={styles.deckButtonWrapper}>
              <button className={styles.deckButton}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  view_carousel
                </span>
                VIEW DECK
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
