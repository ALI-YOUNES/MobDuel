// Shared Socket.IO event contracts between the frontend and the backend.
// These will be mirrored (manually or via a shared package) on the Next.js side.

export type CreateRoomPayload = {
  hostName: string;
};

export type JoinRoomPayload = {
  code: string;
  playerName: string;
};

export type LeaveRoomPayload = {
  roomId: string;
};

export type StartMatchPayload = {
  roomId: string;
};

// Client asks the backend to spin up a solo "practice vs bot" match.
export type PracticeCreatePayload = {
  hostName: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXTRA_HARD';
};

// Raised by the game client whenever the board changes or an action is taken.
export type MatchActionPayload = {
  roomId: string;
  action: 'place' | 'attack' | 'move' | 'craft' | 'sacrifice' | 'useRare' | 'endTurn' | 'changeHand' | 'phase';
  data: Record<string, unknown>;
};

export type PlayerInfo = {
  id: string;
  name: string;
  seat: number;
  isHost: boolean;
};

export type RoomLobbyInfo = {
  roomId: string;
  code: string;
  status: string;
  players: PlayerInfo[];
};

export type ChatMessagePayload = {
  roomId: string;
  text: string;
};

// A board slot expressed from the acting player's point of view.
export type FxSlot = {
  owner: 'self' | 'opponent';
  line: 'active' | 'defense';
  index: number;
};

// Visual events broadcast to BOTH players so animations (laser beams, void
// portals, trap detonations, totem saves, ...) play on every client.
export type MatchFxPayload = {
  actor: string; // playerId whose perspective the slots use
  kind: string; // attack | lightning | void | trap | totem | tnt | boom | swap | power | invisible | respawn
  from?: FxSlot;
  to?: FxSlot;
  targets?: FxSlot[];
};

export const SOCKET_EVENTS = {
  // client -> server
  createRoom: 'room:create',
  joinRoom: 'room:join',
  leaveRoom: 'room:leave',
  startMatch: 'match:start',
  matchAction: 'match:action',
  chatSend: 'chat:send',
  practiceCreate: 'practice:create',

  // server -> client
  roomJoined: 'room:joined',
  roomPlayers: 'room:players',
  roomAbort: 'room:abort',
  matchStarted: 'match:started',
  matchState: 'match:state',
  matchFx: 'match:fx',
  matchEnded: 'match:ended',
  chatMessage: 'chat:message',
  error: 'error',
} as const;
