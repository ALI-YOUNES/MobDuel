import styles from "./Hand.module.css";
import Card from "../sharedComponents/Card";

export default function Hand({ open, mode, cards, onPick, onClose, onLook }) {
  if (!open) return null;

  const visible = cards.filter((c) =>
    mode === "anomaly"
      ? c.Type === "RARE"
      : mode === "summon"
      ? c.Type === "COMMON"
      : c
  );
  const title =
    mode === "anomaly"
      ? "Choose a Rare card to use"
      : mode === "summon"
      ? "Choose a Common card to summon"
      : "My Hand";

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
            <span>{title}</span>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>
            {mode === "anomaly"
              ? "No Rare cards in hand."
              : mode === "summon"
              ? "No summonable cards in hand."
              : "No cards in hand."}
          </p>
        ) : (
          <div className={styles.cards}>
            {visible.map((c) => (
              <div key={c.id} className={styles.cardWrap} onClick={() => onPick(c, mode)}>
                <Card {...c} compact />
                {onLook && (
                  <button
                    className={styles.lookBtn}
                    aria-label="View card"
                    title="View card"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLook(c);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>open_in_full</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
