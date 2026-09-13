import styles from "./StartButton.module.css";

export default function StartButton({ onClick }) {
  return (
    <section className={styles.section}>
      <button className={styles.btn} onClick={onClick}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "30px", fontVariationSettings: "'FILL' 1" }}
        >
          play_arrow
        </span>
        START GAME!
      </button>
    </section>
  );
}
