import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  CreateRoomPayload,
  JoinRoomPayload,
  StartMatchPayload,
  MatchActionPayload,
  LeaveRoomPayload,
  ChatMessagePayload,
  RoomLobbyInfo,
  PracticeCreatePayload,
} from './socket-events';
import { RoomsService } from '../rooms/rooms.service';
import { MatchesService } from '../matches/matches.service';
import { PlayersService } from '../players/players.service';
import { BotService } from '../bots/bot.service';
import { BotDifficulty } from '../bots/bot-ai';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
      if (!origin) return callback(null, true);
      const allowed = (process.env.CLIENT_ORIGIN ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length === 0 || allowed.includes('*') || allowed.includes(origin)) {
        return callback(null, true);
      }
      if ((process.env.NODE_ENV ?? 'development') === 'development') {
        return callback(null, origin);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly matchesService: MatchesService,
    private readonly playersService: PlayersService,
    private readonly botService: BotService,
  ) {}

  afterInit() {
    // Give the bot service a handle on the Socket.IO server so it can push live
    // match state + FX to the human while it plays its own turns.
    this.botService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    // Client connects before joining any room; identity is assigned on join.
    // eslint-disable-next-line no-console
    console.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // eslint-disable-next-line no-console
    console.log(`client disconnected: ${client.id}`);
    // Track the room in client.data because `client.rooms` is already cleared
    // by the time a disconnect event fires in socket.io v4.
    const roomId = client.data.roomId as string | undefined;
    if (!roomId) return;
    // eslint-disable-next-line no-console
    console.log(`[battle] handleDisconnect room=${roomId}`);

    // Stop any bot driver for this practice room (the human left).
    this.botService.stop(roomId);

    // During an active match, a disconnect means the player effectively left:
    // notify the opponent immediately so they can surface "Game Aborted". This
    // is decoupled from DB membership bookkeeping, which is why it always
    // fires even if a transient/reconnecting socket drops.
    void this.roomsService.getById(roomId).then((room) => {
      if (room && room.status === 'IN_GAME') {
        this.server.to(roomId).emit(SOCKET_EVENTS.roomAbort, {});
      }
    });

    // Clean up DB membership (removes the player from the room roster).
    void this.roomsService.leaveRoom(roomId, client.id).then((lobby) => {
      // eslint-disable-next-line no-console
      console.log(`[battle] after disconnect leave, remaining=${lobby ? lobby.players.length : 'deleted'}`);
      if (lobby) {
        this.server.to(roomId).emit(SOCKET_EVENTS.roomPlayers, lobby.players);
      }
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.createRoom)
  async onCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ) {
    try {
      const player = await this.playersService.create({
        name: payload.hostName,
        socketId: client.id,
      });
      const lobby = await this.roomsService.createRoom(player);
      await client.join(lobby.roomId);
      client.data.playerId = player.id;
      client.data.roomId = lobby.roomId;
      client.emit(SOCKET_EVENTS.roomJoined, lobby);
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.joinRoom)
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    try {
      const player = await this.playersService.create({
        name: payload.playerName,
        socketId: client.id,
      });
      const lobby: RoomLobbyInfo = await this.roomsService.joinRoom(
        payload.code,
        player,
      );
      await client.join(lobby.roomId);
      client.data.playerId = player.id;
      client.data.roomId = lobby.roomId;
      client.data.playerName = player.name ?? payload.playerName;
      client.emit(SOCKET_EVENTS.roomJoined, lobby);
      this.server.to(lobby.roomId).emit(SOCKET_EVENTS.roomPlayers, lobby.players);
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.leaveRoom)
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomPayload,
  ) {
    try {
      const lobby = await this.roomsService.leaveRoom(
        payload.roomId,
        client.id,
      );
      await client.leave(payload.roomId);
      // Stop any bot driver for this practice room (the human left).
      this.botService.stop(payload.roomId);
      // eslint-disable-next-line no-console
      console.log(`[battle] room:leave for ${client.id}, remaining=${lobby ? lobby.players.length : 'deleted'}`);
      // Leaving an in-progress match aborts it for everyone.
      const room = await this.roomsService.getById(payload.roomId);
      if (room && room.status === 'IN_GAME') {
        this.server.to(payload.roomId).emit(SOCKET_EVENTS.roomAbort, {});
      }
      if (lobby) {
        this.server.to(payload.roomId).emit(SOCKET_EVENTS.roomPlayers, lobby.players);
      }
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.startMatch)
  async onStartMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartMatchPayload,
  ) {
    try {
      const started = await this.matchesService.start(payload.roomId);
      this.server.to(payload.roomId).emit(SOCKET_EVENTS.matchStarted, started);
      this.server.to(payload.roomId).emit(SOCKET_EVENTS.matchState, started.state);
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.practiceCreate)
  async onPracticeCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PracticeCreatePayload,
  ) {
    try {
      const difficulty: BotDifficulty = (payload.difficulty || 'MEDIUM').toUpperCase() as BotDifficulty;
      const valid: BotDifficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EXTRA_HARD'];
      if (!valid.includes(difficulty)) {
        throw new Error('Unknown bot difficulty.');
      }
      const { lobby, botPlayerId, state } = await this.botService.createPracticeMatch(
        payload.hostName,
        difficulty,
      );
      await client.join(lobby.roomId);
      client.data.playerId = lobby.players[0]?.id;
      client.data.roomId = lobby.roomId;
      client.data.playerName = payload.hostName;

      // Let the host client set up the lobby store and jump straight to battle.
      client.emit(SOCKET_EVENTS.roomJoined, lobby);
      client.emit(SOCKET_EVENTS.matchStarted, {
        matchId: null,
        roomId: lobby.roomId,
        state,
        players: lobby.players.map((p) => p.id),
      });
      client.emit(
        SOCKET_EVENTS.matchState,
        client.data.playerId
          ? this.matchesService.stripTraps(state, client.data.playerId)
          : state,
      );

      this.botService.startDriver(lobby.roomId, botPlayerId, difficulty);
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.matchAction)
  async onMatchAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MatchActionPayload,
  ) {
    try {
      const result = await this.matchesService.applyAction(
        payload.roomId,
        payload.action,
        payload.data,
      );
      // Fan out the new board state. Trap placement is secret: each player only
      // ever sees trap effects on THEIR OWN cards, so broadcast a per-player
      // sanitized copy instead of one shared state.
      const sockets = await this.server.in(payload.roomId).fetchSockets();
      for (const s of sockets) {
        const playerId = s.data.playerId as string | undefined;
        s.emit(
          SOCKET_EVENTS.matchState,
          playerId ? this.matchesService.stripTraps(result.state, playerId) : result.state,
        );
      }
      // Broadcast the visual event to BOTH players (trap SET has no FX, so the
      // secret is never revealed by an animation either).
      if (result.fx && result.fx.length > 0) {
        this.server
          .to(payload.roomId)
          .emit(SOCKET_EVENTS.matchFx, { fx: result.fx });
      }
    } catch (err) {
      client.emit(SOCKET_EVENTS.error, (err as Error).message);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.chatSend)
  async onChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessagePayload,
  ) {
    const name = client.data.playerName ?? 'Guest';
    this.server
      .to(payload.roomId)
      .emit(SOCKET_EVENTS.chatMessage, { from: name, text: payload.text });
  }
}
