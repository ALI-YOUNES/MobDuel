import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { MatchState } from '../matches/match-state';
import { MatchesService } from '../matches/matches.service';
import { RoomsService } from '../rooms/rooms.service';
import { PlayersService } from '../players/players.service';
import { SOCKET_EVENTS, RoomLobbyInfo } from '../socket/socket-events';
import { BotDifficulty, decideAnomaly, decideMain, decideMove, isBotTurn, BotAction } from './bot-ai';

type DriverStage = 'waiting' | 'anomaly' | 'main' | 'place' | 'move' | 'end';

const BOT_NAME: Record<BotDifficulty, string> = {
  EASY: 'Bot_Beginner',
  MEDIUM: 'Bot_Challenger',
  HARD: 'Bot_Ace',
  EXTRA_HARD: 'Bot_Overlord',
};

const BOT_TURN_DELAY_MS = 1600;
const TICK_MS = 1200;

type Driver = {
  roomId: string;
  botId: string;
  difficulty: BotDifficulty;
  stage: DriverStage;
  stopped: boolean;
  timer?: NodeJS.Timeout;
  errorCount?: number;
};

@Injectable()
export class BotService {
  private readonly logger = new Logger('BotService');
  private server: Server | null = null;
  private drivers = new Map<string, Driver>();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly roomsService: RoomsService,
    private readonly playersService: PlayersService,
  ) {}

  /** The socket gateway sets this so the bot can broadcast live updates. */
  setServer(server: Server) {
    this.server = server;
  }

  private botName(difficulty: BotDifficulty): string {
    return `${BOT_NAME[difficulty]}_${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  /**
   * Creates a practice room with a host + a bot opponent, seats both as members,
   * and starts the match. Returns everything the gateway needs to wire up the
   * host socket and begin driving the bot.
   */
  async createPracticeMatch(hostName: string, difficulty: BotDifficulty) {
    const host = await this.playersService.create({ name: hostName || 'Captain' });
    const bot = await this.playersService.create({ name: this.botName(difficulty) });

    // Use the lobby rebuilt AFTER seating the bot, so `players` lists the host
    // AND the bot opponent (the client needs both ids to render the match).
    const room = await this.roomsService.createRoom(host);
    const lobby = await this.roomsService.addMember(room.roomId, bot.id);

    const started = await this.matchesService.start(lobby.roomId);

    return {
      lobby,
      botPlayerId: bot.id,
      hostPlayerId: host.id,
      difficulty,
      state: started.state,
    };
  }

  stop(roomId: string) {
    const d = this.drivers.get(roomId);
    if (d) {
      d.stopped = true;
      if (d.timer) clearTimeout(d.timer);
      this.drivers.delete(roomId);
    }
  }

  /** Begins the autonomous loop that plays the bot's turns for a room. */
  startDriver(roomId: string, botId: string, difficulty: BotDifficulty) {
    this.stop(roomId);
    const driver: Driver = {
      roomId,
      botId,
      difficulty,
      stage: 'waiting',
      stopped: false,
    };
    this.drivers.set(roomId, driver);
    this.scheduleTick(driver, TICK_MS);
  }

  private scheduleTick(driver: Driver, ms: number) {
    if (driver.stopped || !this.drivers.has(driver.roomId)) return;
    driver.timer = setTimeout(() => void this.tick(driver), ms);
  }

  private async getState(roomId: string): Promise<MatchState | null> {
    const match = await this.matchesService.findByRoom(roomId);
    return (match?.state as unknown as MatchState) ?? null;
  }

  private async tick(driver: Driver) {
    if (driver.stopped) return;
    const server = this.server;
    try {
      const state = await this.getState(driver.roomId);
      if (!state || state.winnerId) {
        this.stop(driver.roomId);
        return;
      }

      // It's not the bot's turn yet (or the human still needs to act).
      if (!isBotTurn(state, driver.botId)) {
        driver.stage = 'waiting';
        this.scheduleTick(driver, TICK_MS);
        return;
      }

      // It IS the bot's turn. Figure out what to do next.
      if (driver.stage === 'waiting') driver.stage = 'anomaly';

      const action = this.nextAction(state, driver);

      if (!action) {
        // Nothing left to do on this turn -> end it.
        this.scheduleTick(driver, BOT_TURN_DELAY_MS);
        return;
      }

      const result = await this.matchesService.applyAction(
        driver.roomId,
        action.action,
        action.data,
      );

      // Broadcast the fresh board state per-player (trap sanitized) + FX.
      if (server) {
        const sockets = await server.in(driver.roomId).fetchSockets();
        for (const s of sockets) {
          const pid = s.data.playerId as string | undefined;
          s.emit(
            SOCKET_EVENTS.matchState,
            pid
              ? this.matchesService.stripTraps(result.state, pid)
              : result.state,
          );
        }
        if (result.fx && result.fx.length > 0) {
          server.to(driver.roomId).emit(SOCKET_EVENTS.matchFx, { fx: result.fx });
        }
      }

      this.advanceDriver(driver, action);

      // If the turn just ended, wait for the next turn. Otherwise keep playing.
      if (driver.stopped) return;
      const after = await this.getState(driver.roomId);
      if (after && after.winnerId) {
        this.stop(driver.roomId);
        return;
      }
      if (isBotTurn(after ?? state, driver.botId)) {
        this.scheduleTick(driver, BOT_TURN_DELAY_MS);
      } else {
        driver.stage = 'waiting';
        this.scheduleTick(driver, TICK_MS);
      }
    } catch (err) {
      // A transient invalid action can happen (e.g. race with effect timing).
      // Log it, give up the current stage, and keep ticking rather than dying.
      if (!driver.stopped) {
        this.logger.warn(`bot tick error: ${(err as Error).message}`);
        driver.errorCount = (driver.errorCount || 0) + 1;
        if (driver.errorCount >= 3) {
          // Avoid an infinite loop of the same invalid action: force end turn.
          this.logger.warn(`bot forcing endTurn after repeated errors (${driver.roomId})`);
          await this.forceEndTurn(driver);
          driver.errorCount = 0;
        } else {
          // Re-decide from the main phase next tick (drop the current stage).
          if (driver.stage !== 'main') driver.stage = 'main';
        }
        this.scheduleTick(driver, TICK_MS);
      }
    }
  }

  private async forceEndTurn(driver: Driver) {
    const server = this.server;
    try {
      const result = await this.matchesService.applyAction(driver.roomId, 'endTurn', {});
      if (server) {
        const sockets = await server.in(driver.roomId).fetchSockets();
        for (const s of sockets) {
          const pid = s.data.playerId as string | undefined;
          s.emit(
            SOCKET_EVENTS.matchState,
            pid ? this.matchesService.stripTraps(result.state, pid) : result.state,
          );
        }
        if (result.fx && result.fx.length > 0) {
          server.to(driver.roomId).emit(SOCKET_EVENTS.matchFx, { fx: result.fx });
        }
      }
      driver.stage = 'waiting';
    } catch {
      // ignore; the next tick will retry
    }
  }

  /** Recompute the driver's stage based on the last action and produce the next. */
  private advanceDriver(driver: Driver, action: BotAction) {
    if (action.action === 'useRare') driver.stage = 'main';
    else if (action.action === 'phase' && action.data.phase === 'anomaly') driver.stage = 'main';
    else if (action.action === 'sacrifice') driver.stage = 'place';
    else if (action.action === 'place') driver.stage = 'move';
    else if (
      action.action === 'attack' ||
      action.action === 'changeHand' ||
      (action.action === 'phase' && action.data.phase === 'summon')
    ) {
      driver.stage = 'move';
    } else if (action.action === 'move' || (action.action === 'phase' && action.data.phase === 'move')) {
      driver.stage = 'end';
    } else if (action.action === 'endTurn') {
      driver.stage = 'waiting';
    }
  }

  /** Decide the next concrete action for the current driver stage. */
  private nextAction(state: MatchState, driver: Driver): BotAction | null {
    const botId = driver.botId;
    switch (driver.stage) {
      case 'anomaly':
        return decideAnomaly(state, botId, driver.difficulty);
      case 'main':
        return decideMain(state, botId, driver.difficulty);
      case 'place': {
        // A crafted reward is waiting; place it into the first empty active slot
        // (preferring a column guarded by a defender so the reward is shielded).
        const board = state.boards[botId];
        if (!board) {
          driver.stage = 'move';
          return null;
        }
        const free: number[] = [];
        board.active.forEach((c, i) => {
          if (!c) free.push(i);
        });
        const index = free.find((i) => board.defense[i]) ?? free[0];
        const reward = state.craftResults?.[botId];
        if (reward === undefined || reward === null || index === undefined) {
          driver.stage = 'move';
          return null;
        }
        return {
          action: 'place',
          data: { playerId: botId, index, cardUid: reward.uid, craft: true },
        };
      }
      case 'move':
        return decideMove(state, botId, driver.difficulty);
      case 'end':
        return { action: 'endTurn', data: {} };
      default:
        return null;
    }
  }
}
