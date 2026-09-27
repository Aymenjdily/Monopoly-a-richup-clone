# Phase 4 — Real-time sync

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 4. Project rules: `AGENTS.md` (section 10 + traps 2/3/4/11).

## Goal

Real-time synchronization on Socket.IO attached to the Next HTTP server: typed event
contract shared by server and clients, per-room channels, per-player filtered state
broadcast with a monotonically increasing `version`, action handling shared between
HTTP and sockets, reconnect via snapshot request, and StrictMode-safe client hooks.
The lobby switches from HTTP polling to live socket updates (with HTTP still available
as a fallback transport for actions when sockets are briefly unavailable).

## Files inspected

- `AGENTS.md` section 10, traps 2/3/4/11; `PHASES.md` Phase 4
- `lib/game/stateCodec.ts` (sanitize/client-state boundary), `lib/server/botRuntime.ts`
  (schedule + withRoomLock), `app/api/rooms/[code]/action/route.ts`, `app/room/[code]/ui.tsx`

## Decisions and assumptions

- Socket.IO attaches via the `res.socket.server` pattern in `pages/api/socket.ts`
  (App Router API routes cannot reach the HTTP server instance). Node runtime only —
  fine for `next dev`/`next start`; NOT Vercel-serverless (documented AGENTS.md decision).
- Singleton guarded on `globalThis` (dev hot reload would otherwise re-create the IO server
  and drop all connections on every save).
- One custom path `/api/socketio` for the engine namespace, so page socket.io traffic
  cannot collide with Next internals; clients hit the initializer once before connecting.
- Events contract in `lib/shared/events.ts` (shared types):
  - client→server: `room:join {code,identity}`, `game:action {code,secret,action}`,
    `state:request {code}`
  - server→client: `room:state {view}`, `game:state {code,version,state}`, `game:error {code,message}`
  A rejected action never mutates state and only emits `game:error`.
- Broadcast = whole sanitized state (monopoly has no per-player hidden info), per-player
  secret/deck stripping already in stateCodec; filtered VIEWS per player come later if
  hidden info appears (documented deviation from the literal wording).
- Actions: `processGameAction(code, playerId, secret, action)` extracted into
  `lib/server/gameService.ts` with the per-room lock from botRuntime; reused verbatim by
  the HTTP action route, the socket handler, and the bot runtime persist path.
- Lobby UI replaces its 2.5s poll with the socket hook; HTTP poll stays as file-safe
  fallback only when the socket is not connected.
- Bots: kickIfBotTurn already runs after every committed action (shared via gameService);
  bot chain logic itself is untouched.

## Expected files to create or change

- `lib/shared/events.ts` (new) — the typed contract
- `lib/server/socketRef.ts` (new) — globalThis io reference
- `lib/server/socketServer.ts` (new) — init + handlers (join/state request/action)
- `lib/server/gameService.ts` (new) — processGameAction + persist + broadcast
- `app/api/rooms/[code]/action/route.ts` — thin wrapper over gameService
- `lib/server/botRuntime.ts` — persist via gameService.broadcast
- `pages/api/socket.ts` (new)
- `hooks/useGameSocket.ts` (new) — connect/join/subscribe/dispose, StrictMode-safe
- `app/room/[code]/ui.tsx` — consume hook; poll removed while socket connected
- `package.json` — pin socket.io + socket.io-client (same major)

## Requirements list

1. `room:join` validates identity ( playerId+secret or spectate-lobby state) and joins a
   Socket.IO room named by the game code
2. Every committed action (HTTP or socket) bumps version; the room channel gets
   `game:state` with the fresh sanitized state; stale clients see collision-free ordering
3. `state:request` → fresh `game:state` (reconnect); reconnect allowed only with valid
   identity for a seat (or as a viewer)
4. Secret/deck leakage: emitted payloads pass through stateCodec client filters
5. Action pipeline identical for HTTP/socket/bots (one function, one lock, one broadcast)
6. Client: auto-reconnect → auto `state:request`; only one `game:action` per click
   (StrictMode double-invoke guard on hook connect)
7. Dev hot reload never re-initializes the IO server (globalThis guard)

## Security considerations

- Socket identity = gameState secrets checked per run; no token ever emitted
- Broadcasts pass sanitized state (no secrets, no decks) — property-tested again
- The socket server runs inside the Node process; no new env vars needed (AGENTS.md §12)

## Acceptance criteria

- [ ] Two socket clients joined to one code: an action by one updates both via
      `game:state` with identical versions (live script)
- [ ] `game:error` on out-of-turn action; state byte-identical after rejection
- [ ] Bot turns broadcast `game:state` automatically (chain persists through service)
- [ ] GlobalThis guard: repeated module imports do not re-create the io server
- [ ] Lobby works without hanging HTTP polling when sockets are live

## Checks to run

1. `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`
2. Live: node script with two socket.io-client connections; manual browser: keep a
   room open in two tabs, act in one, see seat money/turn info update in the other.

## Manual test steps

- Tab A create+start (bots optional), Tab B join by code (separate device), roll in Tab A →
  Tab B reflects via socket within ~100ms.
