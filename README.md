# Dice & Deeds

An online multiplayer Monopoly-style board game with a 3D board, in the spirit of richup.io.
Create a room, share the 6-letter code, fill empty seats with bots if you like, and play a full
match in real time in the browser.

All rules run on the server. The browser only renders the game and sends the player's actions.

## Features

- **Rooms:** create a room, join by code, a lobby with live seats, host handover, leave or
  forfeit, and reconnect after a refresh or a dropped connection.
- **Full standard rules:**
  - buying, rent, colour sets, houses and hotels (with even building);
  - mortgages, Chance and Community Chest, taxes and jail;
  - bankruptcy with automatic liquidation to the creditor;
  - the last solvent player wins.
- **Room rules:** the host picks the starting cash, the GO salary, a Free Parking jackpot, rent in
  jail, even building, random seat order and the player limit.
- **Bots with personalities:** cautious, balanced or aggressive, chosen when the host adds a bot.
  Moves are picked by [Jev](https://console.typesafe.ai/) from the engine's legal options, with a
  rule-based fallback, so bots also work with no API key.
- **3D board (three.js):** city tiles with landmark art, tinted in the owner's colour once bought.
  Pawns walk tile by tile, and the dice and the houses and hotels are 3D as well.
- **HUD:**
  - player plates, a property deed card, and the dice tray and actions;
  - a side card with Game history, a **Guide** (advice on what to buy, build or mortgage, and
    what's dangerous ahead), your cities and the room rules.
- **Sound:** synthesized sound effects and a lobby tune (Web Audio, no audio files), with mute
  and volume settings.
- **Persistence:** every game is stored in Postgres, so rooms survive a server restart.

## Tech stack

| Area | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| 3D | three.js via @react-three/fiber and @react-three/drei |
| Styling | Tailwind CSS 4 |
| Real time | Socket.IO 4, attached to the Next.js server |
| Database | Postgres (Neon) via Prisma 7 and the `pg` driver adapter |
| Tests | Vitest |

## Getting started

### Requirements

- Node.js 20 or newer (developed on Node 24).
- A Postgres database. [Neon](https://neon.tech) is what the project uses, and its free tier is enough.

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | **Pooled** Postgres connection string, used by the app at runtime |
| `DIRECT_URL` | yes | **Direct** (unpooled) connection string, used only by migrations |
| `NEXT_PUBLIC_APP_URL` | no | Local URL, for development convenience |
| `TYPESAFE_API_KEY` | no | Jev key for smarter bots. **Server-only.** Without it, bots use the built-in rules |

On Neon, the pooled host contains `-pooler`; the direct one doesn't.

### 3. Create the database and the Prisma client

```bash
npm run db:migrate    # applies prisma/migrations (uses DIRECT_URL)
npm run db:generate   # generates the client into app/generated/prisma (git-ignored)
```

Run `db:generate` again after every fresh clone or schema change. `npm run build` needs it.

### 4. Run

```bash
npm run dev           # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run check` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | All unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run db:migrate` | Create and apply migrations |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:studio` | Browse the database |

## How it works

```
Browser (React + three.js)          Next.js server (Node)                     Postgres
──────────────────────────          ─────────────────────                     ────────
renders state, animates   ──action──▶  validate player → load game ──────────▶  Game row
sends actions only                     engine(state, action, rng) → new state   (state JSON
                          ◀──state───  save (version + 1) → broadcast view  ──▶  + version)
```

- **The engine** (`lib/engine/`) is pure TypeScript: `(state, action, rng) → new state`. It knows
  nothing about React, sockets or the database, and the dice come from a server-seeded RNG passed in.
- **The server** checks each action (player id and secret), runs the engine inside a per-room
  lock, saves the whole state as one JSON column, and broadcasts the result.
- **The browser** receives a per-player filtered view: never the deck order, the RNG or other
  players' secrets. It never decides an outcome, and the dice animation always lands on the
  server's result.
- **Versions:** every save bumps `version`, and a client that falls behind asks for a fresh
  snapshot.
- **Bots** play on memory-only server timers. Any snapshot read restarts the loop if it's a bot's
  turn, so a restart can't strand a game.

### Bots and Jev

On a bot's turn the engine lists the legal moves (roll, buy or pass, pay the fine, use a card,
build, unmortgage, end the turn). If `TYPESAFE_API_KEY` is set, the server sends Jev a short
description of the position from the bot's point of view, plus its personality, and asks it to pick
one of those moves. The bot uses the rule-based choice instead when:

- there's no key;
- Jev takes more than 1.5 s or returns an error;
- the answer isn't one of the listed moves;
- the answer's confidence is below 0.3.

A bot turn therefore never hangs. Only public game facts are sent, and the engine still validates
the chosen move.

## Project structure

```
app/
  page.tsx                 home (create or join)
  room/[code]/             lobby (ui.tsx) and game (GameView.tsx)
  api/rooms/...            REST: create, join, start, action, bots, settings, leave
components/
  board3d/                 three.js scenes: board, pawns, dice, lobby stage, home scene
  hud/                     in-game panels: players, deed card, dock, history, guide
  ui/                      lobby pieces: code tiles, seats, rules sheet, add-bot picker
  sound/                   synthesized sound effects and lobby music
hooks/                     socket client hook and protocol helpers
lib/
  engine/                  pure game engine: rules, board, cards, bots, advisor, settings
  server/                  game service, socket server, bot runtime, Jev bot brain
  game/stateCodec.ts       state (de)serialization and per-player views
  shared/events.ts         typed socket contract shared by server and client
pages/api/socket.ts        attaches Socket.IO to the Next.js HTTP server
prisma/                    schema and migrations (one table: Game)
prompts/                   the implementation plan for each phase
```

## Testing

```bash
npm test
```

The unit tests cover:

- **Engine:** buying and rent, building rules, jail, doubles, cards, bankruptcy and room settings.
- **Server side:** the lobby and presence logic, the advisor, the bot personalities (including whole
  games played by bots) and the Jev brain (against a fake network).
- **Safety:** the state codec, including a check that no secrets reach a client view.

## Deployment

This app needs a **long-running Node server** for WebSockets. Serverless-only platforms such as
Vercel functions won't work. Deploy on any Node host (a VPS, Railway, Render, Fly.io and so on):

1. Set the environment variables above.
2. Run `npm ci && npm run db:generate && npm run build`.
3. Apply the migrations with `npx prisma migrate deploy`.
4. Start the server with `npm start`.

## Contributing

- **[AGENTS.md](AGENTS.md)** holds the product scope, architecture rules and workflow. Read it
  before changing anything.
- **[PHASES.md](PHASES.md)** lists the build order and what's been shipped.
- **Plans:** each feature starts as a plan in `prompts/`.
