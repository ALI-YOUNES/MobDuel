import styles from "./BattleSlot.module.css";
import BattleCard from "./BattleCard";

// Transient animated overlay drawn on top of a card slot while an anomaly
// (Rare card) effect is resolving.
function EffectOverlay({ kind }) {
  if (!kind) return null;
  switch (kind) {
    case "trap":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxTrap}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>warning</span>
        </div>
      );
    case "totem":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxTotem}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>auto_awesome</span>
        </div>
      );
    case "invisible":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxInvisible}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>visibility_off</span>
        </div>
      );
    case "void":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxVoid}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>dark_mode</span>
        </div>
      );
    case "swap":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxSwap}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>swap_horiz</span>
        </div>
      );
    case "lightning":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxLightning}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "34px" }}>bolt</span>
        </div>
      );
    case "respawn":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxRespawn}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>restart_alt</span>
        </div>
      );
    case "tnt":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxTnt}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "34px" }}>local_fire_department</span>
        </div>
      );
    case "power":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxPower}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>monitor_heart</span>
        </div>
      );
    case "boom":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxBoom}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "34px" }}>local_fire_department</span>
        </div>
      );
    case "peek":
      return (
        <div className={`${styles.fxOverlay} ${styles.fxPeek}`}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>visibility</span>
        </div>
      );
    default:
      return null;
  }
}

export default function BattleSlot({
  card,
  variant,
  rotate,
  direction,
  icon,
  placeTarget,
  onClick,
  selectable,
  selected,
  fxAttack,
  targeting,
  fxHit,
  onSelect,
  onTarget,
  moveSource,
  moveSel,
  moveTarget,
  onMoveFrom,
  onMovePlace,
  anomalyTarget,
  anomalySelected,
  onAnomalyPick,
  fxKind,
  badges,
  onLook,
  slotTag,
}) {
  const rotateClass = rotate
    ? direction === "down"
      ? styles.slotRotateDown
      : styles.slotRotateUp
    : "";

  const cardClasses = [
    styles.slot,
    rotateClass,
    moveSource ? styles.moveSource : "",
    moveSel ? styles.moveSel : "",
    selectable ? styles.selectable : "",
    selected ? styles.selected : "",
    fxAttack ? styles.fxAttack : "",
    targeting ? styles.targeting : "",
    fxHit ? styles.fxHit : "",
    anomalyTarget ? styles.anomalyTarget : "",
    anomalySelected ? styles.anomalySelected : "",
    fxKind ? styles["fxKind"] : "",
  ].filter(Boolean).join(" ");

  const clickHandler = card
    ? anomalyTarget
      ? onAnomalyPick
      : moveSource
      ? onMoveFrom
      : selectable
      ? onSelect
      : targeting
      ? onTarget
      : undefined
    : placeTarget
    ? onClick
    : moveTarget
    ? onMovePlace
    : undefined;

  if (card) {
    return (
      <div className={cardClasses} onClick={clickHandler} data-slot={slotTag}>
        <BattleCard card={card} onLook={onLook} badges={badges} />
        <EffectOverlay kind={fxKind} />
      </div>
    );
  }

  return (
    <div
      className={`${styles.slot} ${rotateClass} ${styles[`empty${variant}`] || styles.empty} ${placeTarget ? styles.placeTarget : ""} ${moveTarget ? styles.moveTarget : ""}`}
      onClick={placeTarget ? onClick : moveTarget ? onMovePlace : undefined}
      data-slot={slotTag}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
        {placeTarget ? "add" : moveTarget ? "add" : icon}
      </span>
    </div>
  );
}