import styles from "./PlayerGrid.module.css";

export default function PlayerGrid({ slots }) {
  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        {slots.map((slot, i) =>
          slot ? (
            <slot.component key={i} {...slot.props} />
          ) : (
            <div key={i} className={styles.emptySlot} />
          )
        )}
      </div>
    </section>
  );
}
