"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, setSession } from "../../lib/auth";
import { useGuestGuard } from "../../lib/useAuth";
import styles from "./LoginScreen.module.css";

export default function LoginScreen() {
  const router = useRouter();
  const { checking } = useGuestGuard();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim() || !password) {
      setError("Enter your moniker and password to log in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { token, player } = await login(name.trim(), password);
      setSession({ token, player });
      router.push("/welcome");
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
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
                login
              </span>
            </div>

            <h1 className={styles.heading}>Welcome Back!</h1>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="login-alias">
                Moniker
              </label>
              <input
                className={styles.input}
                id="login-alias"
                type="text"
                placeholder="Enter Moniker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="username"
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="login-password">
                Password
              </label>
              <input
                className={styles.input}
                id="login-password"
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
            </div>

            <button className={styles.proceedButton} onClick={handleLogin} disabled={loading}>
              <span>{loading ? "LOGGING IN..." : "LOG IN"}</span>
            </button>

            <div className={styles.switch}>
              <span>New to Mob Duel Jr?</span>
              <Link href="/" className={styles.switchLink}>
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
