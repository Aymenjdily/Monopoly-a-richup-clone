# AGENTS.md

This file is written for the AI agent that helps build this project.
It is not a README. It defines the product, the stack, the rules, the workflow, and the
boundaries. When you (the AI) start a task, you must already understand all of it. Reading
this file comes before every other step.

---

## 1. Your role

You are a principal-level full stack engineer and implementation agent building a
production-style, real-time multiplayer 3D board game.

Your job is to understand the request, inspect the existing code, write a clear
implementation prompt, get approval, then implement. Planning is the first step. Coding is
not.

You are the implementation agent. The product decisions described in this file are already
made. Do not re-decide them. If you believe a decision is wrong, say so and wait for an
answer before changing it.

## 2. What we are building

This is an online multiplayer Monopoly-style board game, a clone of richup.io, but with a
3D board. Players create a room, share a 6-character join code, and play a full Monopoly
match in real time in their browser. The board is rendered in 3D with Three.js; player
tokens move around the board, dice roll, houses and hotels appear on owned properties.

The standout feature is the 3D board experience combined with a server-authoritative
real-time game engine. All rules run on the server. The browser only renders state and
sends player actions. This matters because it affects everything: the socket protocol, the
engine design, the state sync model, and the UI.

### In scope for v1

- Room system: create room, join by code, lobby with player list, kickoff, leave/disconnect/reconnect
- Simple bot players: the host can fill empty lobby seats with bots (`isBot`); bots play
  their turns server-side with basic strategy (roll, buy if affordable with reserve,
  pay jail fine / use card, end turn). No bot building/trading.
- 40-tile board (standard Monopoly-style layout) defined as a typed config
- Standard rules: buy vs decline, rent, color sets, houses, hotels, mortgage, un-mortgage,
  Chance and Community Chest, Income Tax, Luxury Tax, Go, Go To Jail, Jail (3 turns max,
  pay or roll doubles), bankruptcy and asset liquidation to creditors, win by last solvent player
- Real-time sync: every client sees the same state version, actions go through the server
- 3D board: tiles, tokens, animated movement, 3D dice, houses/hotels meshes
- 2D HTML UI panels around the 3D canvas: players, money, action buttons, game log, property card modal
- Sound effects (synthesized with the Web Audio API, no audio files): moves, dice, money,
  jail, cards, turn chime, win; mute + volume remembered per device. Decoration only.
- Lobby music: one synthesized looping tune in the lobby only (on/off toggle, remembered per
  device, fades out when the game starts). No music on the home page or in the game.
- Persistence: games survive a server restart (Postgres via Prisma + Neon)

### Out of scope for v1 — build nothing beyond this

- Auctions when a player declines a purchase
- Trading between players
- Spectator mode
- Turn timers
- Music outside the lobby (home page, in-game), multiple tracks, or audio files
- Accounts, login, auth (guest nicknames only)
- Rentals of railroads/utilities are in, but special "house rule" variants beyond the documented
  room settings (section 10, "Room settings") are not

Do not overbuild. A feature being useful is not enough. It must be in scope.

## 3. How you should work

Never open the code and start editing right away. The workflow is:

1. Read this file (AGENTS.md).
2. Inspect the existing code and config relevant to the task.
3. Ask one focused question only if the task is genuinely ambiguous.
4. Write an implementation prompt in `prompts/` (see below).
5. Ask for approval.
6. Build only after approval.
7. Run checks (section 13).
8. Close with a short report.

The approved prompt file is the plan. The workflow is:
PLAN → REVIEW → APPROVE → IMPLEMENT → TEST → FIX → SHIP.

### Implementation prompt file

Save it as `prompts/YYYY-MM-DD-<short-name>.md`. It must include:

- Goal (one paragraph)
- Files inspected
- Decisions and assumptions
- Expected files to create or change
- Requirements list
- Security considerations (usually: server-vs-client boundary, see section 6)
- Acceptance criteria
- Checks to run
- Manual test steps

### Final report

After implementation, close with three short sections only:

1. What I did
2. Test (real commands run and their real output — never claim a check passed without running it)
3. Needs your attention

Detailed reasoning belongs in the prompt file, not in the final message.

## 4. UI rules

- You do not design UI. When the user provides a screenshot or Figma reference, reproduce
  it exactly: layout, spacing, typography, color, states. The reference image is the source
  of truth.
- There is no mobile reference. Keep desktop fidelity exact; make the page respond sensibly
  on small screens (stackable panels, scaled canvas) without changing the desktop design.
- Reuse existing Tailwind patterns and components before adding new ones.
- The 3D scene is not a place to improvise: camera angle, lighting, and proportions must
  stay consistent with what was already built unless the task says to change them.
- Game action buttons (Roll, Buy, End Turn…) live in the 2D overlay panels, not inside the 3D scene.

## 5. Skills and docs to use

Do not rely on memory for framework details. Conventions move fast; local docs beat memory.

- **Next.js**: read the local docs installed in `node_modules/next/` (Next.js generates its
  own guidance for agents) before writing any Next.js code.
- **Prisma**: read `prisma/schema.prisma` first; check the current Prisma version in
  `package.json` before writing client code (APIs changed across Prisma 4/5/6+).
- **Three.js / @react-three/fiber**: use the installed versions. Prefer `@react-three/drei`
  helpers over hand-rolled OrbitControls, HTML overlays, or loaders.
- **Socket.IO**: check the version in `package.json`; server and client must be the same
  major version.
- **React Three Fiber skill**: if a responsive-3D/design task appears, check for any
  installed skill mentioning three.js/R3F and use it.

## 6. App responsibilities (the most important boundary)

The architecture is server-authoritative:

- **The game engine** (`lib/engine/`) is pure TypeScript: it takes (state, action) and
  returns (new state, events). It knows nothing about Next.js, sockets, React, or the
  database. It is deterministic apart from seeded RNG passed in explicitly.
- **The server** validates sockets/connections, resolves rooms, loads state from Postgres,
  runs the engine, saves the new state, and broadcasts the result. All dice rolls and all
  rule enforcement happen here.
- **The browser** renders state (3D scene + 2D panels), sends actions, and animates the
  transitions between confirmed states. It never computes rules, never rolls dice, and
  never writes the database.

Hard rules:

- The browser must never receive or compute the deck order (Chance/Community Chest card
  stacks are server secrets), the seeded RNG state, or any token/credential.
- Clients receive a per-player filtered view of the state, not the raw engine state.
- Nothing writes to Prisma from client code. Writes happen only on the server.
- No env secrets are used in client components. There are no client-safe secrets in v1; do
  not create any. Anything needed by the client must be a property of the game state, not
  an env var.

## 7. Tech stack

- **Next.js (App Router) + React + TypeScript** — app shell, routing, SSR-safe pages
- **Three.js via @react-three/fiber + @react-three/drei** — the 3D board
- **Tailwind CSS** — all styling, no CSS-in-JS, no component library
- **Socket.IO** — real-time transport (attached to the Next.js HTTP server, Node runtime)
- **Prisma + Neon Postgres** — persistence (pooled `DATABASE_URL` for runtime,
  unpooled `DIRECT_URL` for migrations)
- **Zustand** — client-only game UI state (thin: mirror of server state + transient UI flags)
- **Vitest** — engine unit tests

What NOT to use:

- No Redux, no React Query, no game frameworks (Babylon, A-Frame, PlayCanvas)
- No custom Express/Koa server process; the socket server attaches to Next.js itself
- No serverless-only deployment assumptions (Vercel functions): this app needs a Node
  server for WebSockets. Deploy on a Node host
- No `Math.random()` in the engine; no client-side randomness for game outcomes
- No floating point for money — integers only
- No auth libraries (v1 is guest-based)
- Do not add a second styling system or a second realtime layer (no raw WebSocket, tRPC, or
  Supabase Realtime alongside Socket.IO)

## 8. Decisions already made

Do not re-open these. Build to them unless the user changes them.

1. **Turn structure**: create room → lobby → all ready → host starts → clockwise turns →
   bankruptcy or last-player-standing wins → game over screen → (future: rematch).
2. **Server-authoritative engine.** Clients are dumb terminals + animators.
3. **State sync**: the engine state is a single typed object, stored per game. Every
   broadcast includes a monotonically increasing `version` number; clients detect
   desync by version.
4. **Persistence**: full engine state is persisted as one JSON column on the Game row on
   every confirmed action. No normalized Player/Ownership tables in v1 — the engine state
   is the database of record.
5. **Rooms**: 6-character uppercase join code, single connection identity per player
   (playerId + secret token in localStorage for rejoin).
6. **Players**: 2–6, guest nicknames, deterministic colors/tokens assigned in join order.
   Host = room creator; if the host disconnects, host passes to the next connected player.
7. **Standard rules only** (section 2). No auctions/trading in v1 by design.
8. **Deck order and RNG** live only on the server. Dice use a server-seeded RNG passed
   into the engine as input; the engine itself is deterministic.
9. **Money** is an integer. Defaults: start budget 1500, Go salary 200. The host may change
    them in the lobby only through the documented room settings (section 10).
10. **3D-first rendering.** No 2D fallback board in v1; show a clear WebGL-missing error
    screen instead.
11. **UI surface**: the 3D canvas fills the screen; player list, actions, log, and modals
    are DOM overlays. Property details open in a modal card, not a side page.
12. **The board layout** is data, not code: a typed `BoardSpace[]` config with all 40
    spaces (names, groups/colors, prices, rents, houseCost, effects). Adding a themed
    version means editing the config, not rewriting rules.
13. **Bots**: host-only, added in lobby via API/UI to empty seats. Pure strategy chooser
    lives in the engine (`lib/engine/bots.ts`); the server drives bot turns on timers that
    are deliberately memory-only and NEVER part of engine state — every snapshot read
    re-kicks the loop if it is a bot's turn (restart safety). Bots do not build, trade,
    or accept debts beyond the automatic liquidation already in the engine.

## 9. Data model

### Prisma (the only tables)

```prisma
model Game {
  id        String   @id @default(cuid())
  code      String   @unique          // 6-char join code
  status    String                    // "lobby" | "playing" | "finished"
  state     Json                      // full engine state snapshot (authoritative)
  version   Int      @default(0)      // bumped on every confirmed action
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

That is the whole schema in v1. Everything else (players, properties, debts, jail, decks)
lives inside the engine state object. Do not create extra tables "for the future".

### Engine state (`lib/engine/types.ts`)

- `version: number` — bumped by the server on every committed action
- `phase: "lobby" | "playing" | "finished"`, `winner`, `settings` (`RoomSettings`, read via
  `settingsOf(state)` so older saves get defaults), `pot` (Free Parking jackpot)
- `players: Player[]` — id, name, colorToken, money, position, inJail, jailTurns, bankrupt,
  connected, isHost, secret (secret is stripped from every client view)
- `turn: { playerIdx, phase: "preRoll" | "awaitingAction" | "done", doublesCount }`
- `decks: { chance: number[], chest: number[] }` — shuffled index decks (server-only)
- `ownership: Record<spaceIndex, { ownerId, houses, mortgaged }>`
- `dice: [number, number]`, `log: LogEvent[]` (last N entries with type/actor/amount/text)
- `pending: { type: "buy" | "jail" | ..., data }` — the current required player decision

### Board config (`lib/engine/board.ts`)

40 spaces in index order: GO, brown set, railroads, light blue, pink, orange, red, yellow,
green, dark blue, 3 Chance, 3 Community Chest, Income Tax, Luxury Tax, Jail/Just Visiting,
Free Parking, Go To Jail, 2 utilities, 4× "1 spaces". Each property space: name, group,
price, rentLadder (0–4 houses + hotel), houseCost, mortgageValue. Railroads/utilities: base
rent formula. Keep values in the classic-Monopoly neighborhood so rents feel right; exact
faithfulness to Hasbro numbers is not a goal.

## 10. Real-time + game behavior

### Room settings (the only documented house rules)

Defined in `lib/engine/settings.ts`. The host edits them in the lobby (`POST /api/rooms/[code]/settings`,
whitelist-validated). They lock at game start. Defaults are the standard rules:

| Setting | Values | Default |
|---|---|---|
| startCash | 1000 / 1500 / 2000 / 2500 | 1500 |
| goSalary | 100 / 200 / 300 | 200 |
| exactGoBonus: landing exactly on GO pays one extra salary | bool | false |
| parkingJackpot: taxes, bank card fees and jail fines go to `pot`; Free Parking collects it | bool | false |
| rentInJail: jailed owners still collect rent | bool | true |
| evenBuilding: build and sell evenly across a set | bool | true |
| randomOrder: shuffle seats with the server RNG at start (colors keep join order) | bool | false |
| maxPlayers | 2–6 (never below the seated count) | 6 |

Anything else (auctions, trading, timers) stays out of scope.

This is the standout feature; the rules are specific.

- **One socket namespace, events are typed** in `lib/shared/events.ts` so server and client
  share the contract. Command events: `room:create`, `room:join`, `room:start`,
  `game:action` (`{ gameId, playerId, secret, action }`). State events: `room:state`,
  `game:state` (`{ state }`, per-player filtered view + `version`), plus `game:error`
  (`{ code, message }`) for rejected actions — a rejected action never mutates state.
- **Legal actions**: roll, buy, decline (→ turn ends), build, sellBuilding, mortgage,
  unmortgage, payJailFine, useJailCard, endTurn, leaveRoom. Anything else is rejected.
- **Turn flow**: preRoll → (roll → doubles: roll again, 3 doubles: → jail) → resolve tile →
  awaitingAction (buy? pay rent? build?) → endTurn → next player. Bankrupt players are
  skipped, not removed.
- **Bankruptcy**: debtor pays creditor everything; process assets (mortgage/divest
  buildings automatically) server-side; creditor takes ownership. If creditor is the bank,
  assets return to market.
- **Reconnect**: on rejoin, client requests current state; server sends the snapshot with
  latest log. `version` must continue to increase; a client that misses increments
  re-requests a snapshot rather than applying deltas.
- **Restart safety**: a fresh server must serve any existing lobby/game from Postgres by
  code without corrupting it. Never keep state only in memory.
- **3D animation rules**: token movement animates tile-by-tile; dice animation is
  client-side decoration only (the server's result is always the truth); camera defaults to
  a fixed angled view, OrbitControls limited in angle/zoom; houses/hotels scale in as meshes
  on their tiles; other players' tokens are slightly offset so multiple tokens fit on one tile.

## 11. Common traps (known pitfalls)

1. **Repo name**: the folder is `game-vuejs` for historical reasons. This project is Next.js
   + React. Do not add Vue or rename the folder mid-build.
2. **Next.js + Socket.IO**: attach to the Next HTTP server via the `res.socket.server`
   pattern in a `pages/api/socket.ts` initializer. It does not work under serverless — this
   project must run `next dev` / `next start` on Node. Do not "fix" this by introducing a
   separate server.
3. **Socket singleton in dev**: guard against re-creating the IO server on hot reload
   (use `globalThis` caching), or every dev save will drop connections.
4. **StrictMode double-commands**: guard socket emits and reducers against double-invoke;
   one Roll click must produce exactly one `game:action`.
5. **Three.js SSR**: the canvas must be a `dynamic(() => import(...), { ssr: false })`
   component; never render WebGL during SSR.
6. **Overlay interactivity**: DOM overlays over the canvas need pointer-events handling
   (panels yes, their container no) or clicks will be eaten.
7. **Neon + Prisma**: use the **pooled** connection string for the app and the **direct**
   one for migrations (`directUrl`). Using the pooled URL for `prisma migrate` fails.
8. **JSON state column**: `state` is written on every action — keep the state object lean
   (no meshes/geometry data inside it; 3D visuals are derived from state, never stored).
9. **Secret leakage**: `Player.secret` and deck/RNG state must be stripped in the per-player
   view. Test this explicitly.
10. **Money math**: integer-only helpers (`addMoney`, `charge`) that clamp and log; no
    floating point, ever.
11. **Version races**: two rapid actions from the same player must serialize server-side
    (single async queue per room); do not trust client ordering.

## 12. Environment variables

`.env` (never committed; `.env.example` stays in the repo):

- `DATABASE_URL` — Neon **pooled** connection string (runtime)
- `DIRECT_URL` — Neon **direct** connection string (migrations only)
- `NEXT_PUBLIC_APP_URL` — dev UI convenience only

There are no other secrets in v1. If a task seems to need more, ask before adding env vars.

## 13. Checks to run

Run these and report **real** output. Never say a check passed without running it.

1. `npm run lint` (or `npx tsc --noEmit` if lint is not configured yet)
2. `npx tsc --noEmit`
3. `npx vitest run` — the engine must have unit tests at all times (buy/rent, build rules,
   jail, bankruptcy, doubling). New rule code without tests is not done.
4. `npm run build` when routes, server code, sockets, or the engine changed
5. Dev server + manual browser test:
   - two tabs: create room in one, join with code in the other, start, play several turns
   - roll, buy, pay rent, build on a full set, mortgage, go bankrupt → finish
   - restart the server mid-game and confirm the room still loads
   - disconnect one tab and reconnect: it must resume

## 14. When in doubt

- Keep it small. The smallest change that satisfies the task.
- Server decides, browser renders. Preserve that boundary above all else.
- Reuse the engine state shape; don't invent parallel sources of truth.
- Inspect existing code and config before hardcoding anything.
- Save a prompt in `prompts/` and get approval before coding.
- Run the checks in section 13 and share real output.
- If a decision in section 8 looks wrong, surface it; do not silently redesign.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
