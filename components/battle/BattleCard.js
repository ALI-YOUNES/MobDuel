import styles from "./BattleCard.module.css";
import Card from "../sharedComponents/Card";

// Persistent anomaly-effect badges shown on boarded cards (Trap, Totem,
// Invisibility, next-power boost).
export const EFFECT_BADGES = [
  { key: "trap", icon: "warning", label: "Trap" },
  { key: "totem", icon: "auto_awesome", label: "Totem" },
  { key: "untargetable", icon: "visibility_off", label: "Invisible" },
];

export default function BattleCard({ card, onLook, badges }) {
  if (!card) return null;
  return (
    <div className={styles.card}>
      <Card
        Name={card.Name}
        Power={card.Power}
        Description={card.Description}
        bgImage={card.bgImage}
        Type={card.Type}
        compact
      />
      {badges && badges.length > 0 && (
        <div className={styles.badges}>
          {badges.map((b) => (
            <span key={b.key} className={`${styles.badge} ${styles[`badge${b.key}`] || styles.badgeTrap}`} title={b.label}>
              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>{b.icon}</span>
              {b.text ? <em>{b.text}</em> : null}
            </span>
          ))}
        </div>
      )}
      {onLook && (
        <button
          className={styles.lookBtn}
          aria-label="View card"
          title="View card"
          onClick={(e) => {
            e.stopPropagation();
            onLook(card);
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>open_in_full</span>
        </button>
      )}
    </div>
  );
}
