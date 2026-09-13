import styles from "./OpponentZone.module.css";
import SlotPair from "./SlotPair";

export default function OpponentZone({
  board,
  targeting,
  validTargets,
  fxTarget,
  onTargetPick,
  anomalyValid,
  anomalySel,
  onAnomalyPick,
  fxKind,
  badgesFor,
  onLook,
}) {
  return (
    <div className={styles.zone}>
      <div className={styles.wrap}>
        <div className={styles.row}>
          {board.map((s, i) => {
            const aValid = anomalyValid && anomalyValid.some((t) => t.index === i && t.line === "active") ? ["active"] : [];
            const dValid = anomalyValid && anomalyValid.some((t) => t.index === i && t.line === "defense") ? ["defense"] : [];
            const valid = [...aValid, ...dValid];
            return (
              <SlotPair
                key={i}
                active={s.active}
                defense={s.defense}
                targetable={targeting && validTargets.includes(i)}
                fxHit={fxTarget === i}
                onTargetPick={() => onTargetPick(i)}
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
                owner="opponent"
                index={i}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
