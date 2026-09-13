import styles from "./Hero.module.css";

export default function Hero({ title, subtitle }) {
  return (
    <div className={styles.hero}>
      <h1 className={styles.heroTitle}>{title}</h1>
      <p className={styles.heroSubtitle}>{subtitle}</p>
    </div>
  );
}
