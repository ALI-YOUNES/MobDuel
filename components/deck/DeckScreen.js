"use client";

import { useEffect, useState } from "react";
import styles from "./DeckScreen.module.css";
import Card from "../sharedComponents/Card";
import { TYPE_KEY } from "../sharedComponents/cardData";
import { fetchCards } from "../../lib/cards";
import { useAuthGuard } from "../../lib/useAuth";

const FILTERS = ["All", "Rare", "Common", "Elite", "Legendary", "Boss"];

export default function DeckScreen() {
  const { checking, player } = useAuthGuard();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCards();
        if (!cancelled) setCards(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const query = search.toLowerCase();
  const filteredCards = cards.filter((c) => {
    const matchesSearch =
      c.Name.toLowerCase().includes(query) ||
      c.Description.toLowerCase().includes(query) ||
      c.Type.toLowerCase().includes(query);
    const matchesFilter =
      activeFilter === "All" || TYPE_KEY[c.Type] === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const t = selectedCard ? TYPE_KEY[selectedCard.Type] || "Common" : "Common";

  if (checking || !player) return null;

  const name = player.name || "Player";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTitle}>
            Mob Duel <span className={styles.headerTitleAccent}>Jr!</span>
          </div>
          <div className={styles.headerDesktop}>
            <span className={styles.levelBadge}>{name} | Level 1</span>
            <div className={styles.searchBar}>
              <span
                className="material-symbols-outlined"
                style={{ color: "#0059bb" }}
              >
                search
              </span>
              <input
                placeholder="Find a card..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.mobileHeader}>
          <div className={styles.mobileHeaderCard}>
            <div className={styles.mobileHeaderTop}>
              <button className={styles.iconBtn}>
                <span className="material-symbols-outlined">menu</span>
              </button>
              <button className={styles.iconBtn}>
                <span className="material-symbols-outlined">tune</span>
              </button>
            </div>
            <h1>My Cards</h1>
            <span className={styles.levelBadge}>{name} | Level 1</span>
          </div>
          <div className={styles.mobileSearch}>
            <span
              className="material-symbols-outlined"
              style={{ color: "#0059bb" }}
            >
              search
            </span>
            <input
              placeholder="Find a card..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.desktopTitle}>
          <h1>My Cards</h1>
        </div>

        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`${styles.filterChip} ${
                activeFilter === f
                  ? styles.filterChipActive
                  : f === "Boss" && activeFilter !== f
                  ? styles.filterChipError
                  : styles.filterChipDefault
              }`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && <p className={styles.noResults}>Loading cards...</p>}

        {error && <p className={styles.noResults}>Error: {error}</p>}

        {!loading && !error && (
          <div className={styles.cardGrid}>
            {filteredCards.map((card) => (
              <Card
                key={card.id}
                Name={card.Name}
                Power={card.Power}
                Type={card.Type}
                bgImage={card.bgImage}
                Description={card.Description}
                onLook={() => setSelectedCard(card)}
              />
            ))}
          </div>
        )}

        {!loading && !error && filteredCards.length === 0 && (
          <p className={styles.noResults}>No cards found.</p>
        )}
      </main>

      {selectedCard && (
        <div className={styles.fullscreen} onClick={() => setSelectedCard(null)}>
          <button className={styles.fullscreenClose} onClick={() => setSelectedCard(null)}>
            <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>close</span>
          </button>
          <div className={styles.fullscreenCard} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.fullscreenHeader} ${styles[`fullscreenHeader${t}`] || styles.fullscreenHeaderCommon}`}>
              <span className={`${styles.fullscreenName} ${t === "Legendary" ? styles.fullscreenNameLegendary : ""}`}>
                {selectedCard.Name}
              </span>
              <span className={`${styles.fullscreenPower} ${styles[`fullscreenPower${t}`] || ""}`}>
                {selectedCard.Power}
              </span>
            </div>

            <div className={`${styles.fullscreenArt} ${styles[`fullscreenArt${t}`] || styles.fullscreenArtCommon}`}>
              {selectedCard.bgImage ? (
                <img className={styles.fullscreenBgImage} src={selectedCard.bgImage} alt={selectedCard.Name} />
              ) : null}
              <div className={`${styles.fullscreenTypeLabel} ${styles[`fullscreenTypeLabel${t}`] || styles.fullscreenTypeLabelCommon}`}>
                {selectedCard.Type}
              </div>
            </div>

            <div className={`${styles.fullscreenFooter} ${t === "Boss" ? styles.fullscreenFooterBoss : ""}`}>
              <p className={`${styles.fullscreenDescription} ${t === "Boss" ? styles.fullscreenDescriptionBoss : ""}`}>
                {selectedCard.Description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
