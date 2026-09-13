import styles from "./RoomCode.module.css";

export default function RoomCode({ code }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Room Code</p>
      <div className={styles.digits}>
        {code.map((char, i) => (
          <span
            key={i}
            className={`${styles.digit} ${i === code.length - 1 ? styles.digitAccent : ""}`}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}
