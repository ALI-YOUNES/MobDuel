import styles from "./HostCard.module.css";

export default function HostCard({ onCreateRoom }) {
  return (
    <section className={`${styles.card} ${styles.host}`}>
      <div className={`${styles.decoCircle} ${styles.decoTopLeft}`} />
      <div className={`${styles.decoCircle} ${styles.decoBottomRight}`} />
      <div className={styles.cardContent}>
        <img
          alt="Walkie Talkie Gadget"
          className={styles.cardImage}
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLXMGTtalHmatVvnu79kJq8g84pgPW73z1Vb0k8-TSTiOkAuNg97AaYGUTa3JZPDPCcqbktQs79Nfk1iRXy9F3_g9mKna7ptKas_ZMzARi2gy2uIgizkmFsvGMOi1nEpW15jNEIvfiVM8q85Mecl5IOkOjXo9OYL9NHVvDqIugEDZ1jWd3My5t6uHExas0XsAM4Bq-6wO7HzAUGzO5s7iYT08KdSG-tWvVADl8h7j5rMWDrNnP1_co"
        />
        <h2 className={styles.cardTitle}>Host a Game</h2>
        <p className={styles.cardDesc}>
          Create a new private room and invite your fellow agents.
        </p>
        <button className={`${styles.bubblyBtn} ${styles.btn}`} onClick={onCreateRoom}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>
            add_circle
          </span>
          Create Room
        </button>
      </div>
    </section>
  );
}
