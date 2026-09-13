import styles from "./LobbyHeader.module.css";
import RoomCode from "./RoomCode";

export default function LobbyHeader({ code, playerCount, maxSlots = 2 }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Waiting for the Crew...</h2>
      <RoomCode code={code} />
      <p className={styles.count}>
        {playerCount} / {maxSlots} agents ready
      </p>
    </section>
  );
}
