"use client";

import { useEffect, useState } from "react";
import styles from "./FullscreenButton.module.css";

export default function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <button className={styles.btn} onClick={toggle} title="Toggle full screen">
      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
        {isFs ? "fullscreen_exit" : "fullscreen"}
      </span>
    </button>
  );
}
