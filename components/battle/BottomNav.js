import styles from "./BottomNav.module.css";

export default function BottomNav({ onSacrifice }) {
  return (
    <nav className={styles.nav}>
      <a className={styles.item} href="#">
        <span className="material-symbols-outlined">style</span>
        <span className={styles.label}>My Deck</span>
      </a>

      <button className={styles.sacrifice} onClick={onSacrifice}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
        <span className={styles.sacrificeLabel}>Sacrifice</span>
      </button>

      <a className={styles.item} href="#">
        <span className="material-symbols-outlined">menu_book</span>
        <span className={styles.label}>Dossier</span>
      </a>

      <a className={styles.item} href="#">
        <span className="material-symbols-outlined">history</span>
        <span className={styles.label}>Battle Log</span>
      </a>
    </nav>
  );
}
