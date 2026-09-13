import { useState } from "react";
import styles from "./SacrificeTable.module.css";
import BattleCard from "./BattleCard";
import { RECIPES } from "../../lib/recipes";
import { sfx } from "../../lib/sounds";

export default function SacrificeTable({ open, boardSlots, hand, onCraft, onClose, onLook }) {
  const [recipe, setRecipe] = useState(RECIPES[0]);
  const [slotted, setSlotted] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);

  if (!open) {
    return null;
  }

  const fuelCards = boardSlots
    .flatMap((s, index) => [
      ...(s.active ? [{ index, line: "active", card: s.active }] : []),
      ...(s.defense ? [{ index, line: "defense", card: s.defense }] : []),
    ])
    .filter((f) => f.card.Type === recipe.reqType);

  const slottedKeys = slotted.map((f) => `${f.index}-${f.line}`);
  const available = fuelCards.filter((f) => !slottedKeys.includes(`${f.index}-${f.line}`));

  const rewardCards = hand.filter((c) => c.Type === recipe.resType);

  const isFull = slotted.length >= recipe.reqCount && recipe.reqCount > 0;

  // Can only craft if there will be an empty active slot left after the fuel is
  // consumed. A fuel slot frees an active slot only when an ACTIVE card with no
  // defender behind it is sacrificed (the defender promotes to active). Fuel
  // taken from the defense line does not free the column's active slot.
  const emptyBefore = boardSlots.filter((s) => !s.active).length;
  const freedSlots = slotted.filter((f) => f.line === "active" && !boardSlots[f.index].defense).length;
  const afterCraftEmpty = emptyBefore + freedSlots;
  const hasSlotAfterCraft = afterCraftEmpty >= 1;

  function handleClose() {
    setSlotted([]);
    setSelectedReward(null);
    onClose();
  }

  function handleSelectRecipe(r) {
    setRecipe(r);
    setSlotted([]);
    setSelectedReward(null);
  }

  function slotCard(fuel) {
    setSlotted((prev) => (prev.length >= recipe.reqCount ? prev : [...prev, fuel]));
    sfx.slot();
  }

  function unslotCard(index) {
    setSlotted((prev) => prev.filter((_, i) => i !== index));
    sfx.unslot();
  }

  const craftReady = isFull && !!selectedReward && hasSlotAfterCraft;

  function handleCraft() {
    onCraft(recipe, slotted, selectedReward);
    setSlotted([]);
    setSelectedReward(null);
  }

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
            </div>
            <h2>Sacrifice Table</h2>
          </div>
          <button className={styles.close} onClick={handleClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.recipes}>
            <h3 className={styles.sectionLabel}>Recipes</h3>
            {RECIPES.map((r) => (
              <button
                key={r.id}
                className={`${styles.recipe} ${recipe.id === r.id ? styles.recipeActive : ""}`}
                onClick={() => handleSelectRecipe(r)}
              >
                <span className={styles.recipeReq}>
                  <span className={styles.count}>{r.reqCount}</span>
                  {r.reqType}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#717786" }}>arrow_forward</span>
                <span className={`${styles.recipeRes} ${styles[r.resClass]}`}>
                  <span className={`${styles.swatch} ${styles[r.resFill]}`} />
                  {r.resType}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.craftArea}>
            <div className={styles.craftRow}>
              <div className={styles.slots}>
                {Array.from({ length: recipe.reqCount }).map((_, i) => {
                  const f = slotted[i];
                  return (
                    <div
                      key={i}
                      className={`${styles.slot} ${f ? styles.slotFilled : ""}`}
                      onClick={() => f && unslotCard(i)}
                    >
                      {f ? <BattleCard card={f.card} onLook={onLook} /> : <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#c1c6d7", fontWeight: 300 }}>tv_displays</span>}
                    </div>
                  );
                })}
              </div>

              <div className={styles.arrow}>
                <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>arrow_forward</span>
                <span className={styles.arrowLabel}>Result</span>
              </div>

              <div className={`${styles.result} ${selectedReward ? styles[`resultBorder${selectedReward.Type}`] : ""}`}>
                {selectedReward ? (
                  <BattleCard card={selectedReward} onLook={onLook} />
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#c1c6d7", opacity: 0.5 }}>help_center</span>
                    <span className={styles.resultText}>Select Recipe</span>
                  </>
                )}
              </div>
            </div>

            <div className={styles.inventory}>
              <h4 className={styles.sectionLabel}>Available to Sacrifice</h4>
              {available.length === 0 ? (
                <p className={styles.emptyText}>No matching cards available.</p>
              ) : (
                <div className={styles.inventoryRow}>
                  {available.map((f, i) => (
                    <div key={i} className={styles.invCard} onClick={() => slotCard(f)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); slotCard(f); } }}>
                      <BattleCard card={f.card} onLook={onLook} />
                      <span
                        className={`${styles.lineTag} ${f.line === "defense" ? styles.lineTagDefense : styles.lineTagActive}`}
                      >
                        {f.line === "defense" ? "DEFENSE" : "ACTIVE"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`${styles.inventory} ${isFull ? "" : styles.hiddenArea}`}>
              <h4 className={styles.sectionLabel}>Choose Your Reward</h4>
              {rewardCards.length === 0 ? (
                <p className={styles.emptyText}>No matching rewards in hand.</p>
              ) : (
                <div className={styles.inventoryRow}>
                  {rewardCards.map((c) => (
                    <div
                      key={c.id}
                      className={`${styles.invCard} ${selectedReward && selectedReward.id === c.id ? styles.invCardSelected : ""}`}
                      onClick={() => { sfx.pick(); setSelectedReward(c); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedReward(c); } }}
                    >
                      <BattleCard card={c} onLook={onLook} />
                      {selectedReward && selectedReward.id === c.id && (
                        <span className={styles.check}>
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.craftBtn} disabled={!craftReady} onClick={handleCraft}>
                Craft
              </button>
              {isFull && !!selectedReward && !hasSlotAfterCraft && (
                <p className={styles.noSlotMsg}>
                  No empty active slot available to place the crafted card.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
