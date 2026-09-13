import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchState, CardInstance, CardEffect } from './match-state';

const BOARD_SIZE = 6;
const HAND_SIZE = 5;

// The 11 Rare / anomaly cards and their canonical names.
const RARE = {
  Spyglass: 'Spyglass',
  MobSwap: 'Mob Swap',
  Trap: 'Trap',
  TheVoid: 'The Void',
  UnstablePower: 'Unstable Power',
  Mutation: 'Mutation',
  LightningStrike: 'Lightning Strike',
  Respawn: 'Respawn',
  Totem: 'Totem of Undying',
  TNT: 'TNT',
  Invisibility: 'Invisibility Potion',
} as const;

// Describes a target chosen on the board: which player's board, which line and
// which column. `owner` of 'opponent' resolves against the opposing player.
type BoardTarget = {
  kind: 'board';
  owner: 'self' | 'opponent';
  line: 'active' | 'defense';
  index: number;
};

type TargetSpec = BoardTarget | { kind: 'player'; owner: 'opponent' };

// A board slot expressed from the acting player's point of view, used by the
// visual-event broadcast (match:fx) so both clients can resolve the exact slot.
export type FxSlot = {
  owner: 'self' | 'opponent';
  line: 'active' | 'defense';
  index: number;
};

export type FxEvent = {
  actor: string; // playerId whose perspective the slots are in
  kind: string; // attack | lightning | void | trap | totem | tnt | boom | swap | power | invisible | respawn
  from?: FxSlot;
  to?: FxSlot;
  targets?: FxSlot[];
};

export type MatchActionResult = {
  state: MatchState;
  fx: FxEvent[];
};

// Narrow a TargetSpec down to a concrete board position, rejecting anything
// that is not one (e.g. a player-target like Spyglass).
function mustBeBoard(t: TargetSpec): BoardTarget {
  if (t.kind !== 'board') {
    throw new BadRequestException('Invalid target position.');
  }
  return t;
}

// Deck composition: exactly 25 cards as agreed with the rules.
const DECK_LAYOUT: Array<[CardInstance['type'], number]> = [
  ['BOSS', 1],
  ['COMMON', 8],
  ['ELITE', 5],
  ['LEGENDARY', 6],
  ['RARE', 5],
];

// Sacrifice recipes (single source of truth for the rules). Shared with the
// frontend so both players validate against the same outcomes.
export type Recipe = {
  id: number;
  reqCount: number;
  reqType: CardInstance['type'];
  resType: CardInstance['type'];
};
export const RECIPES: Recipe[] = [
  { id: 1, reqCount: 3, reqType: 'COMMON', resType: 'LEGENDARY' },
  { id: 2, reqCount: 1, reqType: 'COMMON', resType: 'ELITE' },
  { id: 3, reqCount: 1, reqType: 'ELITE', resType: 'LEGENDARY' },
  { id: 4, reqCount: 3, reqType: 'LEGENDARY', resType: 'BOSS' },
];

function recipeLabel(req: Recipe) {
  return `${req.reqCount} ${req.reqType} -> ${req.resType}`;
}

function uid() {
  return (
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` + Math.random().toString(36).slice(2, 6)
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class MatchesService {
  // Cached card catalog (by id and name) for transforms (Lightning Strike).
  private catalogCache: {
    id: number;
    name: string;
    type: string;
    power: number | null;
    description: string;
  }[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a match for a room and returns its initial state. The room must be
   * in LOBBY and contain at least one player.
   */
  async start(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    const playerIds = room.members.map((m) => m.playerId);
    if (playerIds.length === 0) {
      throw new BadRequestException('A room needs at least one player.');
    }

    const state = await this.makeInitialState(room.hostId, playerIds);

    const match = await this.prisma.match.create({
      data: {
        roomId,
        status: 'IN_PROGRESS',
        state: state as unknown as object,
        players: {
          create: playerIds.map((playerId) => ({ playerId })),
        },
      },
    });

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'IN_GAME' },
    });

    return {
      matchId: match.id,
      roomId,
      state,
      players: playerIds,
    };
  }

  /**
   * Applies a game action to the match and persists the new state.
   * Supports `place` (summon a common card to an empty active slot) and
   * `endTurn` (advance the turn and refill the hand to 5).
   */
  async applyAction(
    roomId: string,
    action: string,
    data: Record<string, unknown>,
  ): Promise<MatchActionResult> {
    const match = await this.prisma.match.findFirst({
      where: { roomId, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
    });
    if (!match) {
      throw new NotFoundException('No in-progress match in this room.');
    }

    const state = (match.state as unknown as MatchState) ?? undefined;
    if (!state) {
      throw new BadRequestException('Match state is missing.');
    }
    const next = this.cloneState(state);
    const fx: FxEvent[] = [];

    if (action === 'place') {
      this.applyPlace(next, data);
    } else if (action === 'sacrifice') {
      this.applySacrifice(next, data);
    } else if (action === 'useRare') {
      this.applyUseRare(next, data, fx);
    } else if (action === 'attack') {
      this.applyAttack(next, data, fx);
    } else if (action === 'move') {
      this.applyMove(next, data);
    } else if (action === 'changeHand') {
      this.applyChangeHand(next, data);
    } else if (action === 'phase') {
      this.applyPhase(next, data);
    } else if (action === 'endTurn') {
      this.applyEndTurn(next);
    } else {
      // Unknown actions are recorded but do not mutate the board.
      next.log = [...next.log, `${action} received (not implemented)`];
    }

    const updated = await this.prisma.match.update({
      where: { id: match.id },
      data: { state: next as unknown as object },
    });

    return { state: updated.state as unknown as MatchState, fx };
  }

  private applyPlace(state: MatchState, data: Record<string, unknown>) {
    const playerId = data.playerId as string;
    const index = data.index as number;
    const cardUid = data.cardUid as string;
    const isCraft = data.craft === true;

    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }
    if (index == null || index < 0 || index >= BOARD_SIZE) {
      throw new BadRequestException('Invalid board position.');
    }

    const board = state.boards[playerId];
    const slot = board.active[index];
    if (slot) {
      throw new BadRequestException('That active slot is already occupied.');
    }

    let card: CardInstance | undefined;
    if (isCraft) {
      const pending = state.craftResults[playerId];
      if (!pending) {
        throw new BadRequestException('No crafted card is pending placement.');
      }
      card = pending;
      state.craftResults[playerId] = null;
    } else {
      const hand = state.hands[playerId] || [];
      card = hand.find((c) => c.uid === cardUid);
      if (!card) {
        throw new BadRequestException('Card is not in your hand.');
      }
      if (card.type !== 'COMMON') {
        throw new BadRequestException('Only Common cards can be summoned directly.');
      }
      state.hands[playerId] = hand.filter((c) => c.uid !== cardUid);
    }

    board.active[index] = card;
    state.log = [...state.log, `${card.name} placed on column ${index + 1}`];
    state.status[playerId] = `placed ${card.name} on column ${index + 1}`;

    // Summoning the Boss ends the game immediately.
    if (card.type === 'BOSS') {
      state.phase = 'done';
      state.winnerId = playerId;
    }
  }

  // ── Rare / anomaly cards ──
  // A Rare card is played on the anomaly phase: pick it from your hand, then
  // select its target(s) on the board. This is the single "Use Anomaly" action.
  private applyUseRare(
    state: MatchState,
    data: Record<string, unknown>,
    fx: FxEvent[],
  ) {
    const playerId = data.playerId as string;
    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }

    const hand = state.hands[playerId] || [];
    const cardUid = data.cardUid as string;
    const card = hand.find((c) => c.uid === cardUid);
    if (!card) {
      throw new BadRequestException('Card is not in your hand.');
    }
    if (card.type !== 'RARE') {
      throw new BadRequestException('Only Rare cards can be used as anomalies.');
    }

    const targets = (data.targets as TargetSpec[]) || [];
    const oppId = Object.keys(state.boards).find((p) => p !== playerId);
    if (!oppId) {
      throw new BadRequestException('No opponent.');
    }

    const resolve = (t: TargetSpec): CardInstance => {
      const b = mustBeBoard(t);
      const line = b.line;
      const index = b.index;
      if (index < 0 || index >= BOARD_SIZE) {
        throw new BadRequestException('Invalid target position.');
      }
      const own = b.owner === 'self';
      const board = own ? state.boards[playerId] : state.boards[oppId];
      if (!board) throw new BadRequestException('No opposing board.');
      const c = board[line][index];
      if (!c) throw new BadRequestException('No card at that position.');
      return c;
    };

    const pushFx = (k: string, targets?: TargetSpec[]) =>
      fx.push({
        actor: playerId,
        kind: k,
        targets: (targets ?? []).map((t) => ({
          owner: mustBeBoard(t).owner,
          line: mustBeBoard(t).line,
          index: mustBeBoard(t).index,
        })),
      });

    // consume the card from the hand up front
    state.hands[playerId] = hand.filter((c) => c.uid !== cardUid);

    switch (card.name) {
      case RARE.Spyglass: {
        // Informational: peer at the opponent's hand. Nothing else changes.
        state.status[playerId] = 'peered at the opponent\'s hand';
        state.log = [...state.log, `${playerId} used Spyglass.`];
        break;
      }

      case RARE.MobSwap: {
        if (targets.length !== 2) throw new BadRequestException('Mob Swap needs two targets.');
        const a = resolve(targets[0]);
        const b = resolve(targets[1]);
        const put = (t: TargetSpec, card: CardInstance) => {
          const bt = mustBeBoard(t);
          const target = state.boards[bt.owner === 'self' ? playerId : oppId];
          target[bt.line][bt.index] = card;
        };
        put(targets[0], b);
        put(targets[1], a);
        state.status[playerId] = `swapped ${a.name} with ${b.name}`;
        state.log = [...state.log, `Mob Swap: ${a.name} <-> ${b.name}`];
        pushFx('swap', targets);
        break;
      }

      case RARE.Trap: {
        if (targets.length !== 1) throw new BadRequestException('Trap needs one target.');
        const t = resolve(targets[0]);
        if (t.type === 'BOSS') throw new BadRequestException('Cannot trap the Boss.');
        state.cardEffects[t.uid] = { ...(state.cardEffects[t.uid] || {}), trap: true };
        state.status[playerId] = 'used a Trap card on one of his Mobs';
        state.log = [...state.log, `${playerId} set a trap on one of his Mobs.`];
        break;
      }

      case RARE.TheVoid: {
        if (targets.length !== 1) throw new BadRequestException('The Void needs one target.');
        const bt = mustBeBoard(targets[0]);
        const t = resolve(targets[0]);
        if (t.type === 'BOSS') throw new BadRequestException('Cannot banish the Boss.');
        const target = state.boards[bt.owner === 'self' ? playerId : oppId];
        delete state.cardEffects[t.uid];
        target[bt.line][bt.index] = null;
        state.status[playerId] = `banished ${t.name} to the void`;
        state.log = [...state.log, `The Void banished ${t.name}.`];
        pushFx('void', targets);
        break;
      }

      case RARE.UnstablePower: {
        if (targets.length !== 1) throw new BadRequestException('Unstable Power needs one target.');
        const t = resolve(targets[0]);
        const np = Math.floor(t.power * (0.5 + Math.random() * 1.0));
        t.power = np;
        state.status[playerId] = `unstable power: ${t.name} now ${np}`;
        state.log = [...state.log, `Unstable Power set ${t.name} to ${np}.`];
        pushFx('power', targets);
        break;
      }

      case RARE.Mutation: {
        if (targets.length !== 1) throw new BadRequestException('Mutation needs one target.');
        const t = resolve(targets[0]);
        const np = Math.floor(t.power * 1.5);
        t.power = np;
        state.status[playerId] = `mutated ${t.name} (+50% power -> ${np})`;
        state.log = [...state.log, `Mutation set ${t.name} to ${np}.`];
        pushFx('power', targets);
        break;
      }

      case RARE.LightningStrike: {
        if (targets.length !== 1) throw new BadRequestException('Lightning Strike needs one target.');
        const t = resolve(targets[0]);
        const transformed = this.transformCard(targets[0], t, playerId, state);
        if (transformed) {
          state.status[playerId] = `${t.name} transformed into ${transformed.name}`;
          state.log = [...state.log, `Lightning Strike turned ${t.name} into ${transformed.name}.`];
        } else {
          t.power = t.power + 10;
          state.status[playerId] = `lightning empowers ${t.name} (+10 power)`;
          state.log = [...state.log, `Lightning Strike gives ${t.name} +10 power.`];
        }
        pushFx('lightning', targets);
        break;
      }

      case RARE.Respawn: {
        const last = state.lastDestroyed[playerId];
        if (!last) throw new BadRequestException('Nothing to respawn yet.');
        const board = state.boards[playerId];
        const index = board.active.findIndex((c) => !c);
        if (index === -1) {
          throw new BadRequestException('Your board is full - no empty slot to respawn into.');
        }
        board.active[index] = last;
        delete state.cardEffects[last.uid];
        state.lastDestroyed[playerId] = null;
        if (last.type === 'BOSS') {
          state.phase = 'done';
          state.winnerId = playerId;
        }
        fx.push({
          actor: playerId,
          kind: 'respawn',
          targets: [{ owner: 'self', line: 'active', index }],
        });
        state.status[playerId] = `respawned ${last.name} onto the board`;
        state.log = [...state.log, `${playerId} respawned ${last.name} to column ${index + 1}.`];
        break;
      }

      case RARE.Totem: {
        if (targets.length !== 1) throw new BadRequestException('Totem needs one target.');
        const t = resolve(targets[0]);
        state.cardEffects[t.uid] = { ...(state.cardEffects[t.uid] || {}), totem: true };
        state.status[playerId] = `gave a Totem of Undying to ${t.name}`;
        state.log = [...state.log, `${playerId} gave ${t.name} a Totem of Undying.`];
        pushFx('totem', targets);
        break;
      }

      case RARE.TNT: {
        if (targets.length !== 2) throw new BadRequestException('TNT needs two targets.');
        const a = resolve(targets[0]);
        const b = resolve(targets[1]);
        if (!this.adjacent(targets[0], targets[1])) {
          throw new BadRequestException('TNT targets must be adjacent.');
        }
        pushFx('tnt', targets);
        this.destroy(state, targets[0], a, fx);
        this.destroy(state, targets[1], b, fx);
        state.status[playerId] = `blew up ${a.name} and ${b.name}`;
        state.log = [...state.log, `TNT destroyed ${a.name} and ${b.name}.`];
        break;
      }

      case RARE.Invisibility: {
        if (targets.length !== 1) throw new BadRequestException('Invisibility Potion needs one target.');
        const bt = mustBeBoard(targets[0]);
        if (bt.owner !== 'self') throw new BadRequestException('Use it on one of your own Mobs.');
        const t = resolve(targets[0]);
        state.cardEffects[t.uid] = { ...(state.cardEffects[t.uid] || {}), untargetable: true };
        state.status[playerId] = `gave ${t.name} Invisibility`;
        state.log = [...state.log, `${playerId} made ${t.name} invisible.`];
        pushFx('invisible', targets);
        break;
      }

      default:
        // unknown Rare not implemented: put the card back
        state.hands[playerId] = [...(state.hands[playerId] || []), card];
        throw new BadRequestException('That Rare card is not implemented.');
    }
  }

  // Resolve Lightning Strike's transform. Pig -> Zombified Piglin (ELITE),
  // Creeper -> Charged Creeper (LEGENDARY). No transform otherwise.
  private transformCard(
    spec: TargetSpec,
    t: CardInstance,
    playerId: string,
    state: MatchState,
  ): CardInstance | null {
    const targetName = t.name === 'Pig' ? 'Zombified Piglin' : t.name === 'Creeper' ? 'Charged Creeper' : null;
    if (!targetName) return null;
    const cat = this.catalogCache.find((c) => c.name === targetName);
    if (!cat) return null;
    const bt = mustBeBoard(spec);
    const oppForTransform = Object.keys(state.boards).find((p) => p !== playerId);
    if (!oppForTransform) return null;
    const target = state.boards[bt.owner === 'self' ? playerId : oppForTransform];
    delete state.cardEffects[t.uid];
    const transformed: CardInstance = {
      id: cat.id,
      uid: uid(),
      name: cat.name,
      type: cat.type as CardInstance['type'],
      power: cat.power ?? 0,
      description: cat.description,
    };
    target[bt.line][bt.index] = transformed;
    return transformed;
  }

  private effectOf(state: MatchState, uid: string): CardEffect {
    return state.cardEffects[uid] || {};
  }

  private destroy(state: MatchState, target: TargetSpec, card: CardInstance, fx?: FxEvent[]) {
    const bt = mustBeBoard(target);
    const pid =
      bt.owner === 'self'
        ? state.currentPlayerId
        : Object.keys(state.boards).find((p) => p !== state.currentPlayerId);
    if (!pid) return;
    const eff = this.effectOf(state, card.uid);
    if (eff.totem) {
      // The Totem of Undying breaks and the Mob survives.
      const owner = bt.owner;
      delete state.cardEffects[card.uid];
      state.status[state.currentPlayerId] = `${card.name} survived with its Totem!`;
      state.log = [...state.log, `${card.name}'s Totem of Undying saved it.`];
      if (fx) {
        fx.push({
          actor: state.currentPlayerId,
          kind: 'totem',
          targets: [{ owner, line: bt.line, index: bt.index }],
        });
      }
      return;
    }
    const board = state.boards[pid];
    board[bt.line][bt.index] = null;
    delete state.cardEffects[card.uid];
    state.graveyard[pid] = state.graveyard[pid] || [];
    state.graveyard[pid].push(card);
    state.lastDestroyed[pid] = card;
    if (fx) {
      fx.push({
        actor: state.currentPlayerId,
        kind: 'boom',
        targets: [{ owner: bt.owner, line: bt.line, index: bt.index }],
      });
    }
  }

  private adjacent(a: TargetSpec, b: TargetSpec): boolean {
    if (a.kind !== 'board' || b.kind !== 'board') return false;
    const sameBoard =
      (a.owner === 'self' && b.owner === 'self') ||
      (a.owner === 'opponent' && b.owner === 'opponent') ||
      a.owner === b.owner;
    if (!sameBoard) return false;
    // same column, active<->defense
    if (a.index === b.index && a.line !== b.line) return true;
    // same line, next column
    if (a.line === b.line && Math.abs(a.index - b.index) === 1) return true;
    // diagonal touch
    if (Math.abs(a.index - b.index) === 1 && a.line !== b.line) return true;
    return false;
  }

  private applySacrifice(state: MatchState, data: Record<string, unknown>) {
    const playerId = data.playerId as string;
    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }

    const recipeId = data.recipeId as number;
    const rewardUid = data.rewardUid as string;
    const fuel = (data.fuel as { index: number; line?: 'active' | 'defense' }[]) || [];

    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      throw new BadRequestException('Unknown recipe.');
    }

    const hand = state.hands[playerId] || [];
    const reward = hand.find((c) => c.uid === rewardUid);
    if (!reward) {
      throw new BadRequestException('Reward card is not in your hand.');
    }
    if (fuel.length !== recipe.reqCount) {
      throw new BadRequestException('Wrong number of fuel cards.');
    }

    const board = state.boards[playerId];

    // Snapshot all fuel cards BEFORE any mutations so that consuming one slot
    // (which may promote a defender) does not invalidate a later reference in
    // the same batch.
    const resolved: { i: number; line: 'active' | 'defense'; card: CardInstance }[] = [];
    for (const f of fuel) {
      const i = f.index;
      const line = f.line === 'defense' ? 'defense' : 'active';
      if (i == null || i < 0 || i >= BOARD_SIZE) {
        throw new BadRequestException('Invalid fuel position.');
      }
      const slot = board[line][i];
      if (!slot || slot.type !== recipe.reqType) {
        throw new BadRequestException('A fuel card is missing or of the wrong type.');
      }
      resolved.push({ i, line, card: slot });
    }

    // Now consume — order no longer matters because the snapshot is immutable.
    for (const { i, line } of resolved) {
      if (line === 'defense') {
        board.defense[i] = null;
      } else {
        const promoted = board.defense[i];
        board.active[i] = promoted;
        board.defense[i] = null;
      }
    }

    // Take the reward from the hand and hold it pending placement.
    state.hands[playerId] = hand.filter((c) => c.uid !== rewardUid);
    state.craftResults[playerId] = reward;

    state.log = [...state.log, `Sacrificed ${recipeLabel(recipe)} for ${reward.name}`];
    state.status[playerId] = `sacrificed ${recipe.reqCount} ${recipe.reqType} for ${reward.name}`;
  }

  private applyAttack(
    state: MatchState,
    data: Record<string, unknown>,
    fx: FxEvent[],
  ) {
    const playerId = data.playerId as string;
    const attackerIndex = data.attackerIndex as number;
    const targetIndex = data.targetIndex as number;

    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }
    // Anti-spam: after a player attacks they must wait two of their own turns.
    const cooldown = state.attackCooldown?.[playerId] || 0;
    if (cooldown > 0) {
      throw new BadRequestException(
        `You cannot attack for ${cooldown} more turn${cooldown === 1 ? '' : 's'}.`,
      );
    }
    if (
      attackerIndex == null ||
      attackerIndex < 0 ||
      attackerIndex >= BOARD_SIZE ||
      targetIndex == null ||
      targetIndex < 0 ||
      targetIndex >= BOARD_SIZE
    ) {
      throw new BadRequestException('Invalid attack positions.');
    }

    const board = state.boards[playerId];
    const attacker = board.active[attackerIndex];
    if (!attacker || attacker.power <= 0) {
      throw new BadRequestException('No attacker at that position.');
    }

    const opponentId = Object.keys(state.boards).find((p) => p !== playerId);
    const ob = opponentId ? state.boards[opponentId] : null;
    if (!ob || !opponentId) {
      throw new BadRequestException('No opponent.');
    }

    // The target is the defending card if present, otherwise the active card.
    const targetLine = ob.defense[targetIndex] ? 'defense' : 'active';
    const target = ob[targetLine][targetIndex];
    if (!target) {
      throw new BadRequestException('No enemy card to attack.');
    }

    // The attack beam flies from the attacker to the target on every client.
    fx.push({
      actor: playerId,
      kind: 'attack',
      from: { owner: 'self', line: 'active', index: attackerIndex },
      to: { owner: 'opponent', line: targetLine, index: targetIndex },
    });

    // Invisibility: the target cannot be targeted at all this turn.
    if (this.effectOf(state, target.uid).untargetable) {
      throw new BadRequestException('That card cannot be targeted right now.');
    }

    // The attack is committed: put the attacker's side on cooldown for 2 turns.
    state.attackCooldown[playerId] = 2;

    // Trap: the defending Mob destroys the attacker BEFORE power is compared.
    if (this.effectOf(state, target.uid).trap) {
      fx.push({
        actor: playerId,
        kind: 'trap',
        targets: [{ owner: 'opponent', line: targetLine, index: targetIndex }],
      });
      delete state.cardEffects[target.uid]; // trap is one-shot
      this.destroy(
        state,
        { kind: 'board', owner: 'self', line: 'active', index: attackerIndex },
        attacker,
        fx,
      );
      state.log = [...state.log, `${target.name}'s trap destroyed ${attacker.name}!`];
      state.status[playerId] = `${target.name} trapped and destroyed ${attacker.name}!`;
      return;
    }

    const aPower = attacker.power;
    const tPower = target.power;

    if (aPower <= tPower) {
      throw new BadRequestException('Not strong enough to destroy that card.');
    }

    this.destroy(
      state,
      { kind: 'board', owner: 'opponent', line: targetLine, index: targetIndex },
      target,
      fx,
    );

    // If the target survived (Totem), do not award a Boss kill.
    if (state.boards[opponentId][targetLine][targetIndex]) {
      state.log = [...state.log, `${attacker.name} hit ${target.name} but it survived.`];
      state.status[playerId] = `attacked ${target.name} (it survived)`;
      return;
    }

    state.log = [...state.log, `${attacker.name} destroyed ${target.name}`];
    state.status[playerId] = `attacked and destroyed ${target.name}`;

    // Destroying the enemy Boss wins the game.
    if (target.type === 'BOSS') {
      state.phase = 'done';
      state.winnerId = playerId;
    }
  }

  // Permanent-power model: Unstable Power / Mutation / Lightning Strike mutate
  // the card's own power permanently, so there is no one-shot next-battle
  // override to clear. This method is retained as a single source for "the
  // power a card fights with" should future effects need to layer on top.
  private battlePower(state: MatchState, card: CardInstance): number {
    return card.power;
  }

  private applyMove(state: MatchState, data: Record<string, unknown>) {
    const playerId = data.playerId as string;
    const fromIndex = data.fromIndex as number;
    const toIndex = data.toIndex as number;
    const line = data.line as 'active' | 'defense';

    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }
    if (
      fromIndex == null ||
      fromIndex < 0 ||
      fromIndex >= BOARD_SIZE ||
      toIndex == null ||
      toIndex < 0 ||
      toIndex >= BOARD_SIZE
    ) {
      throw new BadRequestException('Invalid move positions.');
    }

    const board = state.boards[playerId];
    const card = line === 'active' ? board.active[fromIndex] : board.defense[fromIndex];
    if (!card) {
      throw new BadRequestException('No card to move.');
    }

    if (line === 'active') {
      // Move an active card into a column's empty defense slot. If the source
      // active card had a defending card, it promotes to active.
      if (board.defense[toIndex]) {
        throw new BadRequestException('That defense slot is occupied.');
      }
      board.defense[toIndex] = card;
      board.active[fromIndex] = null;
      if (board.defense[fromIndex]) {
        board.active[fromIndex] = board.defense[fromIndex];
        board.defense[fromIndex] = null;
      }
    } else {
      // Move a defending card into a column's empty active slot.
      if (board.active[toIndex]) {
        throw new BadRequestException('That active slot is occupied.');
      }
      board.active[toIndex] = card;
      board.defense[fromIndex] = null;
    }

    state.log = [...state.log, `${card.name} moved`];
    state.status[playerId] = `moved ${card.name}`;
  }

  private applyChangeHand(state: MatchState, data: Record<string, unknown>) {
    const playerId = data.playerId as string;
    if (state.currentPlayerId !== playerId) {
      throw new BadRequestException('It is not your turn.');
    }

    const hand = state.hands[playerId] || [];
    const deck = state.decks[playerId] || [];
    // Return the current hand to the deck and redraw a fresh hand of 5.
    state.decks[playerId] = shuffle([...deck, ...hand]);
    state.hands[playerId] = [];
    this.refillHand(state, playerId);

    state.log = [...state.log, `Player changed their hand.`];
    state.status[playerId] = 'changed their hand';
  }

  private applyPhase(state: MatchState, data: Record<string, unknown>) {
    const playerId = data.playerId as string;
    const phase = data.phase as string;
    const verb = (data.verb as string) || 'enter';

    const map: Record<string, string> = {
      anomaly: 'entered the Anomaly phase',
      anomaly_skip: 'skipped the Anomaly phase',
      summon: 'entered the Summon / Main phase',
      summon_skip: 'skipped the Summon / Main phase',
      summon_choose: 'is choosing a card to summon',
      sacrifice: 'is using the Sacrifice Table',
      move: 'entered the Move phase',
      move_skip: 'skipped the Move phase',
    };
    // A `skip` verb overrides the "entered ..." text for that phase.
    const text = verb === 'skip' ? map[`${phase}_skip`] : map[phase];
    if (text) state.status[playerId] = text;
  }

  private applyEndTurn(state: MatchState) {
    const players = Object.keys(state.boards);
    const curIdx = players.indexOf(state.currentPlayerId);
    const nextIdx = (curIdx + 1) % players.length;
    const nextPlayer = players[nextIdx];

    // Refill the current player's hand back up to 5 from their deck.
    this.refillHand(state, state.currentPlayerId);

    // Count down the attack cooldown for the player whose turn just ended.
    const cd = state.attackCooldown?.[state.currentPlayerId] || 0;
    if (cd > 0) state.attackCooldown[state.currentPlayerId] = cd - 1;

    state.turn += 1;
    state.currentPlayerId = nextPlayer;
    state.phase = null;
    state.status[state.currentPlayerId] = 'ended their turn';

    // New turn begins for `nextPlayer`: clear their Mob-level timers that are
    // meant to last only through the intervening enemy turn (Invisibility
    // resets at the start of the affected player's next turn).
    const nb = state.boards[nextPlayer];
    const timers = [...nb.active, ...nb.defense].filter((x): x is CardInstance => !!x);
    for (const c of timers) {
      const e = state.cardEffects[c.uid];
      if (!e) continue;
      if (e.untargetable) delete e.untargetable;
      // trap is permanent until consumed (destroyed attacker)
    }

    state.log = [
      ...state.log,
      `Turn ${state.turn} - player ${nextPlayer}'s turn.`,
    ];
  }

  private refillHand(state: MatchState, playerId: string) {
    const hand = state.hands[playerId] || [];
    const deck = state.decks[playerId] || [];
    while (hand.length < HAND_SIZE && deck.length > 0) {
      const card = deck.shift();
      if (card) hand.push(card);
    }
    state.hands[playerId] = hand;
    state.decks[playerId] = deck;
  }

  private cloneState(state: MatchState): MatchState {
    return {
      ...state,
      boards: Object.fromEntries(
        Object.entries(state.boards).map(([pid, b]) => [
          pid,
          { active: [...b.active], defense: [...b.defense] },
        ]),
      ),
      hands: Object.fromEntries(
        Object.entries(state.hands).map(([pid, h]) => [pid, [...h]]),
      ),
      decks: Object.fromEntries(
        Object.entries(state.decks || {}).map(([pid, d]) => [pid, [...d]]),
      ),
      craftResults: { ...(state.craftResults || {}) },
      cardEffects: Object.fromEntries(
        Object.entries(state.cardEffects || {}).map(([uid, e]) => [uid, { ...e }]),
      ),
      graveyard: Object.fromEntries(
        Object.entries(state.graveyard || {}).map(([pid, g]) => [pid, [...g]]),
      ),
      lastDestroyed: { ...(state.lastDestroyed || {}) },
      status: { ...(state.status || {}) },
      log: [...(state.log || [])],
    };
  }

  /**
   * Secret-trap sanitization for a specific viewer. Traps persist on the
   * board, but a player may only ever SEE a trap badge on their OWN cards. For
   * any other viewer, the trap flag (and only the trap flag) is removed from
   * every card the viewer does not own. Untargetable / totem are visible to
   * everyone (they are not secret).
   *
   * Returns a shallow clone with a sanitized `cardEffects` map.
   */
  stripTraps(state: MatchState, viewerId: string): MatchState {
    const sanitized: Record<string, CardEffect> = {};
    for (const [uid, e] of Object.entries(state.cardEffects || {})) {
      if (!e.trap) {
        sanitized[uid] = { ...e };
        continue;
      }
      const owner = this.ownerOf(state, uid);
      if (owner === viewerId) {
        sanitized[uid] = { ...e };
      } else {
        const { trap, ...rest } = e;
        void trap;
        sanitized[uid] = { ...rest };
      }
    }
    return { ...state, cardEffects: sanitized };
  }

  // Which player currently owns `uid` (searched across both boards).
  private ownerOf(state: MatchState, uid: string): string | null {
    for (const pid of Object.keys(state.boards)) {
      const b = state.boards[pid];
      if ((b.active as (CardInstance | null)[]).some((c) => c && c.uid === uid)) return pid;
      if ((b.defense as (CardInstance | null)[]).some((c) => c && c.uid === uid)) return pid;
    }
    return null;
  }

  /**
   * Returns the latest match for a room (any status).
   */
  async findByRoom(roomId: string) {
    return this.prisma.match.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ends a match with a winner.
   */
  async endMatch(roomId: string, winnerId?: string) {
    const match = await this.prisma.match.findFirst({
      where: { roomId, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
    });
    if (!match) {
      throw new NotFoundException('No in-progress match in this room.');
    }

    return this.prisma.match.update({
      where: { id: match.id },
      data: {
        status: winnerId ? 'PLAYER1_WIN' : 'DRAW',
        winnerId: winnerId || null,
      },
    });
  }

  private async makeInitialState(
    hostId: string,
    playerIds: string[],
  ): Promise<MatchState> {
    const boards: MatchState['boards'] = {};
    const hands: MatchState['hands'] = {};
    const decks: MatchState['decks'] = {};
    const craftResults: MatchState['craftResults'] = {};
    const status: MatchState['status'] = {};
    const cardEffects: MatchState['cardEffects'] = {};
    const graveyard: MatchState['graveyard'] = {};
    const lastDestroyed: MatchState['lastDestroyed'] = {};

    const catalog = await this.prisma.card.findMany();
    this.catalogCache = catalog;

    // TEMPORARY TEST SETUP: pre-fill both boards and hands so every new FX
    // (laser attack, lightning, void, trap, totem, TNT, invisibility, Boss
    // placement) can be exercised immediately without deck-building. Remove
    // this block once the animations are validated.
    const mk = (name: string): CardInstance | null => {
      const c = catalog.find((x) => x.name === name);
      if (!c) return null;
      return {
        id: c.id,
        uid: uid(),
        name: c.name,
        type: c.type as CardInstance['type'],
        power: c.power ?? 0,
        description: c.description,
      };
    };
    const useTestSetup = false;

    for (let pi = 0; pi < playerIds.length; pi++) {
      const pid = playerIds[pi];
      graveyard[pid] = [];
      lastDestroyed[pid] = null;
      craftResults[pid] = null;
      status[pid] =
        pid === hostId
          ? 'your turn begins - Summon / Main phase'
          : 'waiting for the match to start';

      if (useTestSetup) {
        const mine = pi === 0;
        // A modest board with an attackable target and a few bodies to fight.
        const activeRow = [
          mine ? mk('Zombie') : mk('Wolf'),
          mine ? mk('Creeper') : mk('Zombie'),
          mine ? mk('Iron Golem') : mk('Creeper'),
          mine ? mk('Pig') : mk('Skeleton'),
          mine ? mk('Bee') : mk('Pig'),
          null,
        ];
        const defenseRow = [
          null,
          mine ? mk('Wolf') : mk('Zombie'),
          null,
          null,
          null,
          null,
        ];
        boards[pid] = {
          active: activeRow,
          defense: defenseRow,
        };
        // Hand: include the Boss + every RARE we want to test + a couple mobs.
        const handNames = mine
          ? ['Ender Dragon', 'Lightning Strike', 'The Void', 'Totem of Undying', 'TNT', 'Trap', 'Invisibility Potion', 'Spyglass']
          : ['Herobrine', 'Lightning Strike', 'The Void', 'Totem of Undying', 'TNT', 'Trap', 'Invisibility Potion', 'Spyglass'];
        hands[pid] = handNames
          .map((n) => mk(n))
          .filter((x): x is CardInstance => !!x);
        decks[pid] = [];
        continue;
      }

      boards[pid] = {
        active: Array(BOARD_SIZE).fill(null),
        defense: Array(BOARD_SIZE).fill(null),
      };
      const deck = this.buildDeck(catalog);
      const hand = deck.slice(0, HAND_SIZE);
      decks[pid] = deck.slice(HAND_SIZE);
      hands[pid] = hand;
    }

    return {
      turn: 1,
      currentPlayerId: hostId,
      phase: 'summon',
      boards,
      hands,
      decks,
      craftResults,
      cardEffects,
      graveyard,
      lastDestroyed,
      attackCooldown: {},
      status,
      log: [`Match started. Turn 1 - host's turn.`],
    };
  }

  // Builds one shuffled 25-card deck (1 Boss, 8 Common, 5 Elite, 6 Legendary,
  // 5 Rare) from the seeded catalog, creating unique instance ids.
  private buildDeck(catalog: { id: number; name: string; type: string; power: number | null; description: string }[]): CardInstance[] {
    const byType: Record<string, typeof catalog> = {};
    for (const c of catalog) {
      (byType[c.type] = byType[c.type] || []).push(c);
    }

    const typ = (t: CardInstance['type']) => byType[t] || [];

    const deck: CardInstance[] = [];
    for (const [type, n] of DECK_LAYOUT) {
      const pool = shuffle(typ(type));
      for (let i = 0; i < n; i++) {
        const card = pool[i % pool.length];
        deck.push({
          id: card.id,
          uid: uid(),
          name: card.name,
          type: type,
          power: card.power ?? 0,
          description: card.description,
        });
      }
    }

    return shuffle(deck);
  }
}
