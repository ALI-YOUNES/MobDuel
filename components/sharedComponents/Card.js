import styles from "./Card.module.css";

const TYPE_KEY = {
  LEGENDARY: "Legendary",
  RARE: "Rare",
  COMMON: "Common",
  BOSS: "Boss",
  ELITE: "Elite",
};

export default function Card({ Name, Power, Description, bgImage, Type, onLook, compact, onClick, selected }) {
  const t = TYPE_KEY[Type] || "Common";

  const handleClick = onLook || onClick;

  return (
    <div
      className={`${styles.card} ${compact ? styles.compact : ""} ${styles[`border${t}`] || styles.borderCommon} ${handleClick ? styles.clickable : ""} ${selected ? styles.selected : ""}`}
      onClick={handleClick}
    >
      <div className={`${styles.header} ${compact ? styles.compactHeader : ""} ${styles[`header${t}`] || styles.headerCommon}`}>
        <span className={`${styles.name} ${compact ? styles.compactName : ""} ${t === "Legendary" ? styles.nameLegendary : ""}`}>
          {Name}
        </span>
      </div>

      <div className={`${styles.art} ${compact ? styles.compactArt : ""} ${styles[`art${t}`] || styles.artCommon}`}>
        <span className={`${styles.power} ${compact ? styles.compactPower : ""} ${styles[`power${t}`] || ""}`}>
          {Power}
        </span>
        {bgImage ? (
          <img className={styles.bgImage} src={bgImage} alt={Name} />
        ) : null}
        <div className={`${styles.typeLabel} ${styles[`typeLabel${t}`] || styles.typeLabelCommon}`}>
          {Type}
        </div>
      </div>

      {compact ? (
        <div className={`${styles.compactFooter} ${styles[`footer${t}`] || ""}`}>
          <p className={`${styles.compactDescription} ${t === "Boss" ? styles.descriptionBoss : ""}`}>
            {Description}
          </p>
        </div>
      ) : (
        <div className={`${styles.footer} ${styles[`footer${t}`] || ""}`}>
          <p className={`${styles.description} ${t === "Boss" ? styles.descriptionBoss : ""}`}>
            {Description}
          </p>
        </div>
      )}
    </div>
  );
}
