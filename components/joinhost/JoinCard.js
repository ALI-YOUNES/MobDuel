"use client";

import { useState } from "react";
import styles from "./JoinCard.module.css";
import CodeInput from "./CodeInput";

export default function JoinCard({ onJoin, error }) {
  const [code, setCode] = useState("");

  const handleJoin = () => {
    const normalized = code.replace(/\s/g, "").trim();
    if (normalized.length !== 4) return;
    onJoin(normalized);
  };

  return (
    <section className={`${styles.card} ${styles.join}`}>
      <div className={`${styles.decoCircle} ${styles.decoTopRight}`} />
      <div className={`${styles.decoCircle} ${styles.decoBottomLeft}`} />
      <div className={styles.cardContent}>
        <img
          alt="Magnifying Glass Gadget"
          className={styles.cardImage}
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQn6Th-WrugRtIhGFOBKgpm9MQa98iRZqGAM4yWLM1GBnVx5MIMwBE1WiMjGMktGbc7RvQZRQ-_nF9lzsc5z0zONORzXNm7E2mJmJ_w5WGquyjA9YrPEiSvpFn-f3nbRC8LgrRyL_oxodsu-_JUmQAYrgN6e3PAS3d2ObGeTNpJiJy4aWd2rZz9i8f20lbxf53vRuKaPMbIruECx6IfKWCrf8mYVkMDYVTATiw-eqaHIU3v7bHvsUX"
        />
        <h2 className={styles.cardTitle}>Join a Game</h2>
        <p className={styles.cardDesc}>
          Enter a 4-digit secret code to sneak into a friend&apos;s room.
        </p>
        <CodeInput error={error} value={code} onChange={setCode} />
        <button className={`${styles.bubblyBtn} ${styles.btn}`} onClick={handleJoin}>
          <span className="material-symbols-outlined" style={{ fontSize: "30px" }}>
            login
          </span>
          Join Room
        </button>
      </div>
    </section>
  );
}
