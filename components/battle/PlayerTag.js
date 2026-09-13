import styles from "./PlayerTag.module.css";

export default function PlayerTag({ icon, name, hp, color = "primary" }) {
  return (
    <div className={`${styles.tag} ${styles[color]}`}>
      <div className={styles.avatar}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <span className={styles.name}>{name}</span>
      <div className={styles.hp}>100 HP</div>
    </div>
  );
}
