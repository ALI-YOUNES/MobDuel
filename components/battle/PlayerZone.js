import styles from "./PlayerZone.module.css";
import SlotPair from "./SlotPair";
import Hand from "./Hand";

export default function PlayerZone({
  board,
  hand,
  handOpen,
  handMode,
  placeTarget,
  onHandPick,
  onCloseHand,
  onPlace,
  attackMode,
  attackerIdx,
  attackable,
  fxAttacker,
  onAttackerPick,
  moveMode,
  moveFrom,
  onMoveFrom,
  onMovePlace,
  anomalyValid,
  anomalySel,
  onAnomalyPick,
  fxKind,
  badgesFor,
  onLook,
}) {
  const moveableActiveIdx = board.map((s, i) => (s.active ? i : -1)).filter((i) => i >= 0);
  const moveableDefenseIdx = board.map((s, i) => (s.defense ? i : -1)).filter((i) => i >= 0);
  // Move targets depend on the source's line:
  //  - moving an active card -> into an empty defense slot of a column that
  //    already has an occupied active slot
  //  - moving a defense card -> into an empty active slot
  const activeMoveTargets = board
    .map((s, i) => (!s.defense && s.active ? i : -1))
    .filter((i) => i >= 0);
  const defenseMoveTargets = board.map((s, i) => (!s.active ? i : -1)).filter((i) => i >= 0);

  return (
    <div className={styles.zone}>
      <div className={styles.wrap}>
        <div className={styles.row}>
          {board.map((s, i) => {
            const isActiveSource =
              moveMode && moveFrom && moveFrom.index === i && moveFrom.line === "active";
            const isDefenseSource =
              moveMode && moveFrom && moveFrom.index === i && moveFrom.line === "defense";
            // Which lines of this column are valid/selected anomaly targets.
            const aValid = anomalyValid && anomalyValid.some((t) => t.index === i && t.line === "active") ? ["active"] : [];
            const dValid = anomalyValid && anomalyValid.some((t) => t.index === i && t.line === "defense") ? ["defense"] : [];
            const valid = [...aValid, ...dValid];
            return (
              <SlotPair
                key={i}
                active={s.active}
                defense={s.defense}
                placeTarget={placeTarget}
                onClick={() => onPlace(i)}
                player
                attackMode={attackMode}
                attackable={attackMode && attackable.includes(i)}
                attackerSelected={attackMode && attackerIdx === i}
                fxAttack={attackMode && fxAttacker === i}
                onAttackerPick={() => onAttackerPick(i)}
                moveMode={moveMode}
                moveableActive={moveableActiveIdx.includes(i)}
                moveableDefense={moveableDefenseIdx.includes(i)}
                moveActiveSel={isActiveSource}
                moveDefenseSel={isDefenseSource}
                moveTargetActive={
                  moveMode && moveFrom && moveFrom.line === "defense" && defenseMoveTargets.includes(i)
                }
                moveTargetDefense={
                  moveMode && moveFrom && moveFrom.line === "active" && activeMoveTargets.includes(i)
                }
                onMoveFrom={(line) => onMoveFrom(i, line)}
                onMovePlace={() => onMovePlace(i)}
                anomalyValid={valid.length ? valid : null}
                anomalySelActive={!!(anomalySel && anomalySel.some((t) => t.index === i && t.line === "active"))}
                anomalySelDefense={!!(anomalySel && anomalySel.some((t) => t.index === i && t.line === "defense"))}
                onAnomalyPick={(line) => onAnomalyPick(i, line)}
                fxKinds={{
                  active: (fxKind || []).find((f) => f.index === i && f.line === "active")?.name,
                  defense: (fxKind || []).find((f) => f.index === i && f.line === "defense")?.name,
                }}
                badgesFor={badgesFor}
                onLook={onLook}
                owner="self"
                index={i}
              />
            );
          })}
        </div>
      </div>

      <Hand
        open={handOpen}
        mode={handMode}
        cards={hand}
        onPick={onHandPick}
        onClose={onCloseHand}
        onLook={onLook}
      />
    </div>
  );
}
