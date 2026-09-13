"use client";

import styles from "./Header.module.css";

export default function Header({ title = "Mob Duel Junior", accent }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <span
          className="material-symbols-outlined"
          style={{ color: "#0070ea", fontSize: "30px" }}
        >
          local_police
        </span>
        <span className={styles.topBarTitle}>
          {title} <span className={styles.accent}>{accent}</span>
        </span>
      </div>
      <div className={styles.topBarRight}>
        <button className={styles.iconBtn}>
          <span className="material-symbols-outlined">help</span>
        </button>
        <button className={styles.userIconBtn}>
          <span className="material-symbols-outlined">person</span>
        </button>
      </div>
    </header>
  );
}
