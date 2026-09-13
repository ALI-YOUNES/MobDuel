import { MatchState, CardInstance } from '../matches/match-state';

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTRA_HARD';

// One concrete `match:action` the bot wants to perform next.
export type BotAction = {
  action: 'useRare' | 'phase' | 'place' | 'attack' | 'sacrifice' | 'move' | 'changeHand' | 'endTurn';
  data: Record<string, unknown>;
};

type Pos = { line: 'active' | 'defense'; index: number };
type Mob = { pos: Pos; card: CardInstance };

// Confidence / reasoning budget at each difficulty. Higher = more likely to
// commit to the strongest greedy move and to use Rares well. Lower = jittery,
// weak play that misses obvious wins and blunders into bad trades.
const CONFIDENCE: Record<BotDifficulty, number> = {
  EASY: 0.2,
  MEDIUM: 0.5,
  HARD: 0.8,
  EXTRA_HARD: 1.0,
};

export function botHand(state: MatchState, botId: string): CardInstance[] {
  return state.hands[botId] || [];
}

export function botBoard(state: MatchState, botId: string): Mob[] {
  const b = state.boards[botId];
  if (!b) return [];
  const out: Mob[] = [];
  for (let i = 0; i < b.active.length; i++) if (b.active[i]) out.push({ pos: { line: 'active', index: i }, card: b.active[i] as CardInstance });
  for (let i = 0; i < b.defense.length; i++) if (b.defense[i]) out.push({ pos: { line: 'defense', index: i }, card: b.defense[i] as CardInstance });
  return out;
}

export function oppBoard(state: MatchState, botId: string): Mob[] {
  const oppIds = Object.keys(state.boards).filter((p) => p !== botId);
  const oppId = oppIds[0];
  const b = oppId ? state.boards[oppId] : null;
  if (!b) return [];
  const out: Mob[] = [];
  for (let i = 0; i < b.active.length; i++) if (b.active[i]) out.push({ pos: { line: 'active', index: i }, card: b.active[i] as CardInstance });
  for (let i = 0; i < b.defense.length; i++) if (b.defense[i]) out.push({ pos: { line: 'defense', index: i }, card: b.defense[i] as CardInstance });
  return out;
}

export function oppId(state: MatchState, botId: string): string | null {
  return Object.keys(state.boards).find((p) => p !== botId) || null;
}

function hasEffect(state: MatchState, card: CardInstance, key: string): boolean {
  return !!(state.cardEffects[card.uid] && (state.cardEffects[card.uid] as any)[key]);
}

function activeAttackers(state: MatchState, botId: string): Mob[] {
  const b = state.boards[botId];
  if (!b) return [];
  const out: Mob[] = [];
  b.active.forEach((c, index) => {
    if (c && c.power > 0) out.push({ pos: { line: 'active', index }, card: c });
  });
  return out;
}

// Rough strategic value of a card: killing/buffing higher-value cards wins.
const TYPE_WEIGHT: Record<string, number> = {
  RARE: 30,
  BOSS: 10000,
  LEGENDARY: 22,
  ELITE: 12,
  COMMON: 5,
};

function targetValue(card: CardInstance): number {
  return (card.power || 0) * 2 + (TYPE_WEIGHT[card.type] || 0);
}

// How valuable a target must be before an attack is worth the 2-turn cooldown.
const MIN_KILL_VALUE: Record<BotDifficulty, number> = {
  EASY: 0, // blunders: attacks the first thing it can beat
  MEDIUM: 8,
  HARD: 14,
  EXTRA_HARD: 18,
};

// Effective attack target per opponent column: you always hit the defense card
// first; the active card behind it is not reachable while a defender stands.
function oppEffectiveTargets(state: MatchState, botId: string): { index: number; card: CardInstance }[] {
  const oppIds = Object.keys(state.boards).filter((p) => p !== botId);
  const oppId = oppIds[0];
  const b = oppId ? state.boards[oppId] : null;
  if (!b) return [];
  const out: { index: number; card: CardInstance }[] = [];
  for (let i = 0; i < b.active.length; i++) {
    if (b.defense[i]) out.push({ index: i, card: b.defense[i] as CardInstance });
    else if (b.active[i]) out.push({ index: i, card: b.active[i] as CardInstance });
  }
  return out;
}

// Choose the best attack available. Returns null if none is favorable.
function bestAttack(state: MatchState, botId: string, difficulty: BotDifficulty, rng: () => number): BotAction | null {
  // Anti-spam: skip attacking while the side is cooling down from a prior attack.
  if ((state.attackCooldown?.[botId] || 0) > 0) return null;
  const attackers = activeAttackers(state, botId);
  const enemies = oppEffectiveTargets(state, botId);
  if (!attackers.length || !enemies.length) return null;

  const ob = state.boards[oppId(state, botId) || ''];
  const minKill = MIN_KILL_VALUE[difficulty];

  let best: { atk: Mob; tgt: { index: number; card: CardInstance }; value: number } | null = null;
  for (const atk of attackers) {
    for (const enemy of enemies) {
      if (hasEffect(state, enemy.card, 'untargetable')) continue;
      const delta = atk.card.power - enemy.card.power;
      if (delta <= 0) continue; // does not win the trade
      if (hasEffect(state, enemy.card, 'trap') && atk.card.type !== 'BOSS') continue; // avoid traps

      // Value of killing this target now: its own worth plus the card we
      // expose behind it (killing a defender unlocks the active card it was
      // shielding for a future attack).
      let value = targetValue(enemy.card);
      if (ob && ob.defense[enemy.index]) {
        const behind = ob.active[enemy.index];
        if (behind) value += targetValue(behind) * 0.4;
      }
      if (value < minKill) continue; // not worth spending the 2-turn cooldown

      // Prefer the biggest-value kill; tie-break on a safer power margin.
      if (!best || value > best.value || (value === best.value && delta > best.atk.card.power - best.tgt.card.power)) {
        best = { atk, tgt: enemy, value };
      }
    }
  }
  if (!best) return null;

  // Lower difficulties sometimes pass on a winning trade (make mistakes).
  if (rng() > CONFIDENCE[difficulty]) return null;

  return {
    action: 'attack',
    data: {
      playerId: botId,
      attackerIndex: best.atk.pos.index,
      targetIndex: best.tgt.index,
    },
  };
}

function bestSacrifice(state: MatchState, botId: string, rng: () => number): BotAction | null {
  const board = state.boards[botId];
  if (!board) return null;
  const hand = state.hands[botId] || [];

  // Recipe: 3 LEGENDARY -> BOSS ; 3 COMMON -> LEGENDARY ; 1 COMMON -> ELITE ;
  // 1 ELITE -> LEGENDARY
  const countType = (type: string) => board.active.filter((c) => c && c.type === type).length;

  // Craft a chess-piece threshold decision. Only EXTRA_HARD/HARD chase the Boss hard.
  const legendary = countType('LEGENDARY');
  const common = countType('COMMON');
  const elite = countType('ELITE');

  // Reward we want: prefer a reward that exists in our hand to consume.
  const findReward = (type: string) => hand.find((c) => c.type === type);
  const emptyActive = board.active.findIndex((c) => !c);

  const recipes = [
    // { reqType, reqCount, resType, fuelPredicate }
    { reqType: 'LEGENDARY', reqCount: 3, resType: 'BOSS', available: legendary, reward: (t: string) => findReward('BOSS') },
    { reqType: 'COMMON', reqCount: 3, resType: 'LEGENDARY', available: common, reward: (t: string) => findReward('LEGENDARY') },
    { reqType: 'ELITE', reqCount: 1, resType: 'LEGENDARY', available: elite, reward: (t: string) => findReward('LEGENDARY') },
    { reqType: 'COMMON', reqCount: 1, resType: 'ELITE', available: common, reward: (t: string) => findReward('ELITE') },
  ] as const;

  for (const r of recipes) {
    if (r.available < r.reqCount) continue;
    const reward = r.reward('');
    if (!reward) continue;
    // Don't strip the board down to almost nothing, unless we are grabbing a
    // Boss (place = immediate win, never backfires). Keep at least 2 mobs on
    // the board after the sacrifice + the placed reward.
    const after = board.active.filter((c) => c).length - r.reqCount + 1;
    if (after < 2 && r.resType !== 'BOSS') continue;
    // Need an empty active slot after consuming the fuel to place the result.
    const fuelSlots = board.active
      .map((c, i) => (c && c.type === r.reqType ? i : -1))
      .filter((i) => i >= 0)
      // Sacrifice our weakest cards of the required type, keep the strong ones.
      .sort((a, b) => (board.active[a] as CardInstance).power - (board.active[b] as CardInstance).power)
      .slice(0, r.reqCount);
    if (fuelSlots.length < r.reqCount) continue;
    const occupiedAfter = board.active.filter((c) => !!c).length - r.reqCount;
    if (occupiedAfter >= board.active.length) continue; // no room to place
    const recipeId = recipeIdFor(r.reqCount, r.reqType, r.resType);
    if (recipeId == null) continue;

    return {
      action: 'sacrifice',
      data: {
        playerId: botId,
        recipeId,
        rewardUid: reward.uid,
        fuel: fuelSlots.map((index) => ({ index, line: 'active' as const })),
      },
    };
  }

  return null;
}

function recipeIdFor(reqCount: number, reqType: string, resType: string): number | null {
  // Mirrors RECIPES in matches.service.ts
  if (reqCount === 3 && reqType === 'COMMON' && resType === 'LEGENDARY') return 1;
  if (reqCount === 1 && reqType === 'COMMON' && resType === 'ELITE') return 2;
  if (reqCount === 1 && reqType === 'ELITE' && resType === 'LEGENDARY') return 3;
  if (reqCount === 3 && reqType === 'LEGENDARY' && resType === 'BOSS') return 4;
  return null;
}

// Summon the strongest COMMON we hold into a good column: prefer a column that
// already has a defender (free protection), otherwise any free active slot.
function pickPlace(state: MatchState, botId: string, rng: () => number): BotAction | null {
  const board = state.boards[botId];
  const hand = state.hands[botId] || [];
  if (!board) return null;

  const commons = hand
    .filter((c) => c.type === 'COMMON')
    .sort((a, b) => b.power - a.power);
  if (!commons.length) return null;

  const free: number[] = [];
  const defendedFree: number[] = [];
  board.active.forEach((c, i) => {
    if (!c) (board.defense[i] ? defendedFree : free).push(i);
  });
  if (!defendedFree.length && !free.length) return null;

  const pool = defendedFree.length ? defendedFree : free;
  const index = pool[Math.floor(rng() * pool.length)];
  return {
    action: 'place',
    data: { playerId: botId, index, cardUid: commons[0].uid, craft: false },
  };
}

function pickChangeHand(state: MatchState, botId: string): BotAction | null {
  const deck = state.decks[botId] || [];
  if (deck.length === 0) return null;
  // Reached only when no place / sacrifice / attack is possible. A redraw is
  // almost always better than wasting the main action (or skipping it) and
  // gives the bot a fresh shot at COMMONs to summon.
  return { action: 'changeHand', data: { playerId: botId } };
}

// Mirrors the backend's TNT adjacency rule (same column active/defense, same
// line neighbours, or diagonal touch).
function isAdjacent(a: { line: 'active' | 'defense'; index: number }, b: { line: 'active' | 'defense'; index: number }): boolean {
  if (a.index === b.index && a.line !== b.line) return true;
  if (a.line === b.line && Math.abs(a.index - b.index) === 1) return true;
  if (Math.abs(a.index - b.index) === 1 && a.line !== b.line) return true;
  return false;
}

// Decide which RARE to use in the anomaly phase (if any). Tries the most
// impactful cards first and returns the first one that has a legal target.
function bestRare(state: MatchState, botId: string, difficulty: BotDifficulty, rng: () => number): BotAction | null {
  const hand = state.hands[botId] || [];
  if (!hand.length) return null;

  // Aggressive / decisive rares first, then utility, then informational.
  const order = [
    'The Void',
    'TNT',
    'Lightning Strike',
    'Mutation',
    'Unstable Power',
    'Trap',
    'Totem of Undying',
    'Invisibility Potion',
    'Mob Swap',
    'Respawn',
    'Spyglass',
  ];

  const enemies = oppBoard(state, botId);
  const own = botBoard(state, botId);
  const board = state.boards[botId];

  // Buff target: our strongest active card, favouring one sitting behind a
  // defender (a safe investment). Falls back to defenders if nothing is active.
  const bestBuffTarget = (): { owner: 'self'; line: 'active' | 'defense'; index: number } | null => {
    const pool = own.filter((m) => m.pos.line === 'active').length ? own.filter((m) => m.pos.line === 'active') : own;
    const m = [...pool].sort((a, b) => {
      const pa = a.card.power + (board && board.defense[a.pos.index] ? 10 : 0);
      const pb = b.card.power + (board && board.defense[b.pos.index] ? 10 : 0);
      return pb - pa;
    })[0];
    if (!m) return null;
    return { owner: 'self', line: m.pos.line, index: m.pos.index };
  };

  // Trap target: our strongest card (excluding the Boss) - enemies want to
  // clear the biggest threat, and the trap eats whoever attacks it.
  const bestTrapTarget = (): { owner: 'self'; line: 'active' | 'defense'; index: number } | null => {
    const list = own.filter((m) => m.card.type !== 'BOSS');
    const m = [...list].sort((a, b) => b.card.power - a.card.power)[0];
    if (!m) return null;
    return { owner: 'self', line: m.pos.line, index: m.pos.index };
  };

  for (const name of order) {
    const card = hand.find((c) => c.name === name);
    if (!card) continue;

    switch (card.name) {
      case 'The Void': {
        const targets = enemies
          .filter((e) => e.card.type === 'COMMON' || e.card.type === 'ELITE')
          .sort((a, b) => targetValue(b.card) - targetValue(a.card));
        if (!targets.length) continue;
        const picked = targets[0];
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [{ kind: 'board', owner: 'opponent', line: picked.pos.line, index: picked.pos.index }] as any } };
      }
      case 'TNT': {
        let bestPair: [Mob, Mob] | null = null;
        let bestVal = -1;
        for (let i = 0; i < enemies.length; i++) {
          for (let j = i + 1; j < enemies.length; j++) {
            if (!isAdjacent(enemies[i].pos, enemies[j].pos)) continue;
            const v = targetValue(enemies[i].card) + targetValue(enemies[j].card);
            if (v > bestVal) {
              bestVal = v;
              bestPair = [enemies[i], enemies[j]];
            }
          }
        }
        if (!bestPair) continue;
        return {
          action: 'useRare',
          data: {
            playerId: botId,
            cardUid: card.uid,
            targets: bestPair.map((m) => ({ kind: 'board', owner: 'opponent', line: m.pos.line, index: m.pos.index })) as any,
          },
        };
      }
      case 'Lightning Strike':
      case 'Mutation':
      case 'Unstable Power': {
        const t = bestBuffTarget();
        if (!t) continue;
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [{ kind: 'board', ...t }] as any } };
      }
      case 'Trap': {
        const t = bestTrapTarget();
        if (!t) continue;
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [{ kind: 'board', ...t }] as any } };
      }
      case 'Totem of Undying':
      case 'Invisibility Potion': {
        const t = bestBuffTarget();
        if (!t) continue;
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [{ kind: 'board', ...t }] as any } };
      }
      case 'Respawn': {
        if (!state.lastDestroyed[botId]) continue;
        if (!state.boards[botId].active.some((c) => !c)) continue;
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [] } };
      }
      case 'Mob Swap': {
        const targets = own.slice(0, 2);
        if (targets.length < 2) continue;
        return {
          action: 'useRare',
          data: {
            playerId: botId,
            cardUid: card.uid,
            targets: targets.map((m) => ({ kind: 'board', owner: 'self', line: m.pos.line, index: m.pos.index })) as any,
          },
        };
      }
      case 'Spyglass': {
        // Free information - better bots use it more often to read the hand.
        if (rng() > CONFIDENCE[difficulty]) continue;
        return { action: 'useRare', data: { playerId: botId, cardUid: card.uid, targets: [] } };
      }
      default:
        continue;
    }
  }

  return null;
}

// Decide the single, best "main action" for the bot.
function bestMainAction(state: MatchState, botId: string, difficulty: BotDifficulty, rng: () => number): BotAction {
  const att = bestAttack(state, botId, difficulty, rng);
  if (att) return att;
  const sac = bestSacrifice(state, botId, rng);
  if (sac) return sac;
  const place = pickPlace(state, botId, rng);
  if (place) return place;
  const ch = pickChangeHand(state, botId);
  if (ch) return ch;
  // No good main action -> skip straight to move.
  return { action: 'phase', data: { playerId: botId, phase: 'summon', verb: 'skip' } };
}

function bestMove(state: MatchState, botId: string): BotAction | null {
  // The bot almost never has defenders to promote (defense cards only appear
  // by RETREATING an active card into defense), so the move phase is used to
  // build shield walls: pull a weak mob in front of the strongest active card.
  const board = state.boards[botId];
  if (!board) return null;

  // 1) Promote a standing-alone defender (active-empty + defense-filled column)
  //    straight forward. Never strip a shield out from under an active card.
  const lone: number[] = [];
  board.active.forEach((c, i) => {
    if (!c && board.defense[i]) lone.push(i);
  });
  if (lone.length) {
    let from = lone[0];
    for (const d of lone) {
      if ((board.defense[d] as CardInstance).power > (board.defense[from] as CardInstance).power) from = d;
    }
    return { action: 'move', data: { playerId: botId, fromIndex: from, toIndex: from, line: 'defense' } };
  }

  // 2) Shield the crown jewel: retreat a weak active mob into the empty defense
  //    slot of the column holding our strongest active card.
  let target = -1;
  let targetPower = 0;
  board.active.forEach((c, i) => {
    if (!c || board.defense[i]) return;
    if (c.power > targetPower) {
      targetPower = c.power;
      target = i;
    }
  });
  if (target === -1) return null;

  let from = -1;
  let fromPower = Infinity;
  board.active.forEach((c, i) => {
    if (!c || i === target || board.defense[i]) return;
    if (c.power < fromPower) {
      fromPower = c.power;
      from = i;
    }
  });
  // Only bother if the sacrificed mob is meaningfully weaker than what we shield.
  if (from === -1 || targetPower - fromPower < 3) return null;

  return { action: 'move', data: { playerId: botId, fromIndex: from, toIndex: target, line: 'active' } };
}

export function decideAnomaly(state: MatchState, botId: string, difficulty: BotDifficulty): BotAction {
  const rng = () => Math.random();
  const r = bestRare(state, botId, difficulty, rng);
  if (r && rng() < CONFIDENCE[difficulty]) return r;
  // Skip the anomaly phase.
  return { action: 'phase', data: { playerId: botId, phase: 'anomaly', verb: 'skip' } };
}

export function decideMain(state: MatchState, botId: string, difficulty: BotDifficulty): BotAction {
  const rng = () => Math.random();
  return bestMainAction(state, botId, difficulty, rng);
}

export function decideMove(state: MatchState, botId: string, difficulty: BotDifficulty): BotAction {
  const m = bestMove(state, botId);
  if (m) return m;
  return { action: 'phase', data: { playerId: botId, phase: 'move', verb: 'skip' } };
}

export function isBotTurn(state: MatchState, botId: string): boolean {
  return !!state && state.currentPlayerId === botId && !state.winnerId;
}
