import styles from "./MobileTopBar.module.css";

export default function MobileTopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.title}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
        <span>Mob Duel Jr</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.iconBtn} aria-label="Settings">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <button className={styles.iconBtn} aria-label="Help">
          <span className="material-symbols-outlined">help</span>
        </button>
      </div>
    </header>
  );
}
