// The live state of a match, persisted as JSON on the Match model.
// Mirrors the client-side board representation so it can be forwarded as-is.

export type CardInstance = {
  id: number; // card catalog id
  uid: string; // unique instance id for a specific card on the board
  name: string;
  type:
    | 'LEGENDARY'
    | 'RARE'
    | 'COMMON'
    | 'BOSS'
    | 'ELITE';
  power: number;
  description?: string;
  bgImage?: string;
};

// Persistent per-instance effects applied by Rare/anomaly cards. Stored in a
// map keyed by the card's unique instance uid so they travel with the card as
// it moves between hand and board, and are consulted during battle resolution.
export type CardEffect = {
  untargetable?: boolean; // cannot be targeted by enemy attacks until next turn
  totem?: boolean; // survives the first destruction attempt, then consumed
  trap?: boolean; // destroys the attacker before power compare (once, secret to owner)
  bomb?: boolean; // pending bomb placement (TNT auxiliary)
};

export type BoardLine = (CardInstance | null)[];

export type PlayerBoard = {
  active: BoardLine;
  defense: BoardLine;
};

export type MatchState = {
  turn: number;
  currentPlayerId: string;
  phase: 'anomaly' | 'summon' | 'move' | 'done' | null;
  boards: Record<string, PlayerBoard>;
  hands: Record<string, CardInstance[]>;
  /*** Remaining cards to draw from (shuffled) for each player. */
  decks: Record<string, CardInstance[]>;
  /*** A crafted (sacrificed) card waiting to be placed on the board. */
  craftResults: Record<string, CardInstance | null>;
  /*** Persistent Rare/anomaly effects, keyed by card instance uid. */
  cardEffects: Record<string, CardEffect>;
  /*** Recently destroyed cards per player (for Respawn). */
  graveyard: Record<string, CardInstance[]>;
  /*** The last card destroyed on a player's side (for Respawn). */
  lastDestroyed: Record<string, CardInstance | null>;
  /*** Turns remaining before a player may attack again (anti-spam cooldown). */
  attackCooldown: Record<string, number>;
  /*** Human-readable current status per player (shown to the opponent). */
  status: Record<string, string>;
  winnerId?: string;
  log: string[];
};
