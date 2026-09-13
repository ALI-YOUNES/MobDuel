"use client";

import styles from "./CardModal.module.css";

const TYPE_KEY = {
  LEGENDARY: "Legendary",
  RARE: "Rare",
  COMMON: "Common",
  BOSS: "Boss",
  ELITE: "Elite",
};

export default function CardModal({ card, onClose }) {
  if (!card) return null;
  const t = TYPE_KEY[card.Type] || "Common";

  return (
    <div className={styles.fullscreen} onClick={onClose}>
      <button className={styles.fullscreenClose} onClick={onClose} aria-label="Close">
        <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>close</span>
      </button>
      <div
        className={`${styles.fullscreenCard} ${styles[`fullscreenCard${t}`] || ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.fullscreenHeader} ${styles[`fullscreenHeader${t}`] || styles.fullscreenHeaderCommon}`}>
          <span className={styles.rarityChip}>{card.Type}</span>
          <span className={`${styles.fullscreenName} ${t === "Legendary" ? styles.fullscreenNameLegendary : ""}`} title={card.Name}>
            {card.Name}
          </span>
        </div>

        <div className={`${styles.fullscreenArt} ${styles[`fullscreenArt${t}`] || styles.fullscreenArtCommon}`}>
          {card.bgImage ? (
            <img className={styles.fullscreenBgImage} src={card.bgImage} alt={card.Name} />
          ) : null}
          <div className={styles.fullscreenScrim} />
          <div className={`${styles.powerBadge} ${styles[`powerBadge${t}`] || ""}`}>
            <span className={styles.powerLabel}>POWER</span>
            <span className={styles.powerValue}>{card.Power}</span>
          </div>
          <div className={`${styles.fullscreenTypeLabel} ${styles[`fullscreenTypeLabel${t}`] || styles.fullscreenTypeLabelCommon}`}>
            {card.Type}
          </div>
        </div>

        <div className={`${styles.fullscreenFooter} ${t === "Boss" ? styles.fullscreenFooterBoss : ""}`}>
          <span className={styles.footerLabel}>Effect</span>
          <p className={`${styles.fullscreenDescription} ${t === "Boss" ? styles.fullscreenDescriptionBoss : ""}`}>
            {card.Description}
          </p>
        </div>
      </div>
    </div>
  );
}
