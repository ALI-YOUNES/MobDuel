"use client";

import styles from "./BottomNav.module.css";

const NAV_ITEMS = [
  { icon: "star", label: "Missions", href: "#", active: true },
  { icon: "school", label: "Academy", href: "#" },
  { icon: "folder_shared", label: "Dossier", href: "#" },
];

export default function BottomNav() {
  return (
    <nav className={styles.bottomNav}>
      <div className={styles.bottomNavInner}>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            className={`${styles.navItem} ${item.active ? styles.navItemActive : ""}`}
            href={item.href}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
