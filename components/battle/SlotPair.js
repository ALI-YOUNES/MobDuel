import styles from "./SlotPair.module.css";
import BattleSlot from "./BattleSlot";

export default function SlotPair({
  active,
  defense,
  placeTarget,
  onClick,
  player = false,
  attackMode,
  attackable,
  attackerSelected,
  fxAttack,
  onAttackerPick,
  targetable,
  fxHit,
  onTargetPick,
  moveMode,
  moveableActive,
  moveableDefense,
  moveActiveSel,
  moveDefenseSel,
  moveTargetActive,
  moveTargetDefense,
  onMoveFrom,
  onMovePlace,
  anomalyValid,
  anomalySelActive,
  anomalySelDefense,
  onAnomalyPick,
  fxKinds,
  badgesFor,
  onLook,
  owner,
  index,
}) {
  // Opponent slot: the target card is the defender if present, else the active card.
  const targetIsDefense = targetable && defense;
  const targetIsActive = targetable && !defense && active;

  // Anomaly (Rare) targeting: decide which of the two lines in this column are
  // valid/selected targets, and any transient FX overlay to show.
  const anomalyActive = anomalyValid && anomalyValid.includes("active");
  const anomalyDefense = anomalyValid && anomalyValid.includes("defense");

  const activeSlot = (
    <BattleSlot
      card={active}
      variant={player ? "PlayerActive" : "Active"}
      icon="tv_displays"
      placeTarget={placeTarget && !active}
      onClick={placeTarget && !active ? onClick : undefined}
      selectable={attackable}
      selected={attackerSelected}
      fxAttack={fxAttack}
      onSelect={attackable ? onAttackerPick : undefined}
      targeting={targetIsActive}
      fxHit={fxHit && targetIsActive}
      onTarget={targetIsActive ? onTargetPick : undefined}
      moveSource={moveMode && moveableActive && !!active}
      moveSel={moveMode && moveActiveSel}
      moveTarget={moveMode && moveTargetActive && !active}
      onMoveFrom={() => onMoveFrom("active")}
      onMovePlace={() => onMovePlace()}
      anomalyTarget={anomalyActive}
      anomalySelected={anomalySelActive}
      onAnomalyPick={() => onAnomalyPick("active")}
      fxKind={fxKinds?.active}
      badges={badgesFor ? badgesFor(active) : undefined}
      onLook={onLook}
      slotTag={owner ? `${owner}-active-${index}` : undefined}
    />
  );

  const defenseSlot = (
    <BattleSlot
      card={defense}
      variant={player ? "PlayerDefense" : "Active"}
      rotate
      direction={player ? "up" : "down"}
      targeting={targetIsDefense}
      fxHit={fxHit && targetIsDefense}
      onTarget={targetIsDefense ? onTargetPick : undefined}
      moveSource={moveMode && moveableDefense && !!defense}
      moveSel={moveMode && moveDefenseSel}
      moveTarget={moveMode && moveTargetDefense && !defense}
      onMoveFrom={() => onMoveFrom("defense")}
      onMovePlace={() => onMovePlace()}
      anomalyTarget={anomalyDefense}
      anomalySelected={anomalySelDefense}
      onAnomalyPick={() => onAnomalyPick("defense")}
      fxKind={fxKinds?.defense}
      badges={badgesFor ? badgesFor(defense) : undefined}
      onLook={onLook}
      slotTag={owner ? `${owner}-defense-${index}` : undefined}
    />
  );

  return (
    <div className={styles.pair}>
      {/* Opponent: active on top, defense below. Player (swapped): defense on top, active below.
          This puts both defense lines nearest the middle so they face each other. */}
      {player ? (
        <>
          <div className={styles.defenseCell}>{defenseSlot}</div>
          <div className={styles.activeCell}>{activeSlot}</div>
        </>
      ) : (
        <>
          <div className={styles.activeCell}>{activeSlot}</div>
          <div className={styles.defenseCell}>{defenseSlot}</div>
        </>
      )}
    </div>
  );
}
