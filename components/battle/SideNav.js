import { useEffect, useRef, useState } from "react";
import styles from "./SideNav.module.css";
import { sfx } from "../../lib/sounds";

export default function SideNav({
  phase,
  canEndTurn,
  onAnomaly,
  onSummon,
  onSacrifice,
  onAttack,
  attackActive,
  attackCooldown = 0,
  onChangeHand,
  onMove,
  onSkipMove,
  onEndTurn,
  onViewHand,
  myTurn = false,
  ready = false,
}) {
  const isActive = (id) => phase === id;
  const alreadyDone = (id) =>
    phase !== null &&
    phase !== "done" &&
    ["anomaly", "summon", "move"].indexOf(id) < ["anomaly", "summon", "move"].indexOf(phase);

  // The turn bar slides in and lights up on our turn, and dims/recedes while
  // we wait for the opponent.
  const waiting = ready && !myTurn;
  const [muted, setMuted] = useState(sfx.isMuted());

  // Auto-scroll the phase list so the active phase is always visible.
  const containerRef = useRef(null);
  const phaseEls = useRef({});
  useEffect(() => {
    if (!phase || phase === "done") return;
    const container = containerRef.current;
    const el = phaseEls.current[phase];
    if (container && el) {
      container.scrollTo({
        top: el.offsetTop - container.offsetTop - 6,
        behavior: "smooth",
      });
    }
  }, [phase]);

  return (
    <nav className={`${styles.nav} ${myTurn ? styles.navOpen : styles.navWaiting}`}>
      <div className={styles.head}>
        <button
          className={styles.muteBtn}
          onClick={() => {
            sfx.unlock();
            setMuted(sfx.toggleMute());
          }}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          title={muted ? "Unmute" : "Mute"}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>
            {muted ? "volume_off" : "volume_up"}
          </span>
        </button>
        <div className={styles.headIcon}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: "28px" }}>view_cozy</span>
        </div>
        <div>
          <h1 className={styles.headTitle}>Mission Phases</h1>
          <p className={`${styles.headSub} ${myTurn ? styles.subMine : styles.subWaiting}`}>
            {waiting ? (
              <>
                <span className={`material-symbols-outlined ${styles.subIcon}`}>hourglass_empty</span>
                Waiting for opponent...
              </>
            ) : (
              <>
                <span className={`material-symbols-outlined ${styles.subIcon}`}>schedule</span>
                Your Turn
              </>
            )}
          </p>
        </div>
      </div>

      {waiting && (
        <div className={styles.waitBanner}>
          <span>It&apos;s the opponent&apos;s turn.</span>
        </div>
      )}

      <button className={styles.viewHand} onClick={onViewHand}>
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>style</span>
        Show my hand
      </button>

      <div className={styles.phases} ref={containerRef}>
        <div
          className={`${styles.phase} ${!isActive("anomaly") ? styles.phaseInactive : ""}`}
          ref={(el) => (phaseEls.current["anomaly"] = el)}
        >
          <div className={`${styles.phaseTitle} ${isActive("anomaly") ? styles.phaseTitleActive : ""}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>emergency_home</span>
            <span className={styles.label}>Anomaly Phase</span>
            {isActive("anomaly") && <span className={styles.pulseDot} />}
            {alreadyDone("anomaly") && <span className={`material-symbols-outlined ${styles.doneIcon}`}>check_circle</span>}
          </div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} disabled={!isActive("anomaly")} onClick={() => onAnomaly(true)}>Use Anomaly</button>
            <button className={styles.actionBtn} disabled={!isActive("anomaly")} onClick={() => onAnomaly(false)}>Skip</button>
          </div>
        </div>

        <div
          className={`${styles.phase} ${!isActive("summon") ? styles.phaseInactive : ""}`}
          ref={(el) => (phaseEls.current["summon"] = el)}
        >
          <div className={`${styles.phaseTitle} ${isActive("summon") ? styles.phaseTitleActive : ""}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "24px", fontVariationSettings: isActive("summon") ? "'FILL' 1" : "" }}>swords</span>
            <span className={styles.label}>Summon/Attack</span>
            {isActive("summon") && <span className={styles.pulseDot} />}
            {alreadyDone("summon") && <span className={`material-symbols-outlined ${styles.doneIcon}`}>check_circle</span>}
          </div>
          <div className={`${styles.actions} ${styles.actionsColumn}`}>
            <button className={`${styles.actionBtn} ${styles.yellow}`} disabled={!isActive("summon")} onClick={onSummon}>Summon Common</button>
            <button className={`${styles.actionBtn} ${styles.gray}`} disabled={!isActive("summon")} onClick={onSacrifice}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>auto_fix_high</span>
              Sacrifice
            </button>
            <button
              className={`${styles.actionBtn} ${styles.orange} ${attackActive ? styles.attackActive : ""}`}
              disabled={!isActive("summon") || attackCooldown > 0}
              onClick={onAttack}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px", fontVariationSettings: attackActive ? "'FILL' 1" : "" }}>flash_on</span>
              {attackActive ? "Done Attacking" : "Attack"}
            </button>
            {attackCooldown > 0 && (
              <span className={styles.cooldownNote}>
                Attacks locked for {attackCooldown} more turn{attackCooldown === 1 ? "" : "s"}.
              </span>
            )}
            <button className={`${styles.actionBtn} ${styles.yellow}`} disabled={!isActive("summon")} onClick={onChangeHand}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>refresh</span>
              Change my hand
            </button>
          </div>
        </div>

        <div
          className={`${styles.phase} ${!isActive("move") ? styles.phaseInactive : ""}`}
          ref={(el) => (phaseEls.current["move"] = el)}
        >
          <div className={`${styles.phaseTitle} ${isActive("move") ? styles.phaseTitleActive : ""}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>directions_run</span>
            <span className={styles.label}>Move Phase</span>
            {isActive("move") && <span className={styles.pulseDot} />}
            {alreadyDone("move") && <span className={`material-symbols-outlined ${styles.doneIcon}`}>check_circle</span>}
          </div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} disabled={!isActive("move")} onClick={onMove}>Move Card</button>
            <button className={styles.actionBtn} disabled={!isActive("move")} onClick={onSkipMove}>Skip</button>
          </div>
        </div>
      </div>

      <button className={styles.endTurn} disabled={!canEndTurn} onClick={onEndTurn}>End Turn</button>
    </nav>
  );
}
