"use client";

import styles from "./CodeInput.module.css";

export default function CodeInput({ error, value, onChange }) {
  const handleInput = (e) => {
    const raw = e.target.value.replace(/[^A-Z0-9]/g, "").toUpperCase();
    const formatted = raw.replace(/(.{1})/g, "$1 ").trim();
    onChange(formatted);
  };

  return (
    <>
      <div className={styles.wrapper}>
        <span
          className="material-symbols-outlined"
          style={{ color: "#717786", position: "absolute", left: "16px" }}
        >
          dialpad
        </span>
        <input
          className={styles.input}
          maxLength={7}
          onInput={handleInput}
          placeholder="0 0 0 0"
          type="text"
          value={value}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
