import styles from "./PlayerCard.module.css";

export default function PlayerCard({ name, subtitle, tag, tagColor, isHost, active }) {
  return (
    <div className={`${styles.card} ${active ? styles.cardActive : ""}`}>
      {isHost && (
        <div className={styles.hostBadge}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
        </div>
      )}
      <div className={`${styles.avatar} ${active ? styles.avatarActive : ""}`}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "48px", color: "#ffffff" }}
        >
          person
        </span>
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{name}</p>
        {subtitle ? (
          <div className={styles.subtitle}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <p className={styles.subtitleText}>{subtitle}</p>
          </div>
        ) : (
          <p className={`${styles.tag} ${tagColor ? styles[tagColor] : ""}`}>{tag}</p>
        )}
      </div>
    </div>
  );
}
