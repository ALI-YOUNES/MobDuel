# Mob Duel Jr — Backend

NestJS + PostgreSQL + Socket.IO backend for **Mob Duel Jr**.

- **Runtime**: Node.js 20+ (developed on Node 24)
- **Framework**: [NestJS](https://nestjs.com) 11
- **ORM**: [Prisma](https://www.prisma.io) 6
- **Real-time**: Socket.IO (via `@nestjs/websockets`)
- **DB**: PostgreSQL 16

## Project layout

```
backend/
├─ prisma/
│  ├─ schema.prisma        # data model (players, rooms, matches, cards)
│  ├─ seed.ts              # seeds the card catalog
│  └─ docker-compose.yml   # optional local Postgres
├─ src/
│  ├─ main.ts              # bootstrap: CORS, validation, prefix, port
│  ├─ app.module.ts        # root module wiring
│  ├─ prisma/              # PrismaModule + PrismaService (singleton, global)
│  ├─ socket/              # Socket.IO gateway + event contracts
│  │  ├─ socket.gateway.ts
│  │  ├─ socket.module.ts
│  │  └─ socket-events.ts  # single source of event names/payload types
│  ├─ players/             # Player entity + create/find REST (used by rooms)
│  ├─ rooms/               # room create/join/leave + lobby payload
│  └─ matches/             # match start/action/end + board state (JSON)
├─ .env / .env.example
├─ package.json
└─ tsconfig*.json
```

## Prerequisites

1. **PostgreSQL** — either:
   - a local install, **or**
   - Docker: `docker compose up -d` (in `backend/`) — creates `mobduel` db on `localhost:5432` with user/pass `mobduel`.
2. **Node.js 20+**.

## Setup & run

```bash
cd backend

# 1. Install dependencies (already done in this repo)
npm install

# 2. Configure environment
copy .env.example .env          # edit DATABASE_URL / PORT if needed

# 3. Create the database schema (run migrations)
npm run prisma:migrate   # = prisma migrate dev

# 4. Seed the card catalog
npm run prisma:seed

# 5. Start the API (dev watch)
npm run start:dev
```

Server runs at **http://localhost:3001** (REST under `/api`) and opens a Socket.IO gateway on the same port.

### Useful scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Run API with watch reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run prisma:migrate` | Apply schema changes as a new migration |
| `npm run prisma:seed` | Upsert the card catalog |
| `npm run prisma:studio` | Browse the database (Prisma Studio) |
| `npm run prisma:generate` | Regenerate the Prisma Client after schema edits |

## REST endpoints (prefix `/api`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | API status |
| GET | `/api/players` | List players |
| POST | `/api/players` | Create a player |
| GET | `/api/players/:id` | Get a player |
| DELETE | `/api/players/:id` | Delete a player |
| GET | `/api/rooms/:code` | Get a room's lobby by code |
| GET | `/api/matches/room/:roomId` | Latest match for a room |
| POST | `/api/matches/room/:roomId/end` | End a match |

## Socket.IO events

Event names and payload types are centralized in `src/socket/socket-events.ts`.

**Client → Server**

| Event | Payload | Purpose |
| --- | --- | --- |
| `room:create` | `{ hostName }` | Depth host creates a room + lobby |
| `room:join` | `{ code, playerName }` | Join a lobby by code |
| `room:leave` | `{ roomId }` | Leave the room |
| `match:start` | `{ roomId }` | Host starts the match |
| `match:action` | `{ roomId, action, data }` | Apply a game action (place/attack/move/craft/endTurn) |
| `chat:send` | `{ roomId, text }` | Send a chat message |

**Server → Client**

| Event | Payload |
| --- | --- |
| `room:joined` | `RoomLobbyInfo` |
| `room:players` | `RoomLobbyInfo` (players changed) |
| `match:started` | `{ matchId, roomId, state, players }` |
| `match:state` | `MatchState` (board snapshot) |
| `match:ended` | result payload |
| `chat:message` | `{ from, text }` |
| `error` | message string |

The board is modelled by `MatchState` in `src/matches/match-state.ts`: each player has an `active` and `defense` line of 6 slots, a hand, a phase and a turn index. The client is currently the game engine; the backend persists the state JSON and fans out updates so other players stay in sync.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP + Socket.IO port |
| `DATABASE_URL` | `postgresql://mobduel:mobduel@localhost:5432/mobduel?schema=public` | Prisma connection string |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Comma-separated CORS / Socket origin allowlist |
