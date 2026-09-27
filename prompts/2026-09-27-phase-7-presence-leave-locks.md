# Phase 7 (part 1) — presence, host handover, leaving, lobby locks + end-to-end verification

Date: 2026-09-27. Approved by the user ("ok do things") after the gap audit.
Work is on branch `feat/v1-game`; the pre-existing work was committed first.

## Goal

Close the spec gaps found in the audit:

- **Presence and host handover:** track who is connected. When the host disconnects, the host
  role passes to the next connected human (AGENTS.md decision 6).
- **Leaving:** players can leave. In the lobby this frees the seat; in a game it's a
  forfeit through the listed `leaveRoom` action.
- **Lobby locks:** every lobby write goes through the per-room lock (AGENTS.md trap 11).

Then verify the flows that were never run end to end: a game to the finish, building on a
full set, server restart and reconnect.

## Files inspected

`lib/engine/{engine,lobby,types}.ts`, `lib/server/{socketServer,botRuntime,gameService}.ts`,
`app/api/rooms/[code]/*/route.ts`, `app/room/[code]/{ui,GameView}.tsx`, `components/hud/*`, `hooks/useGameSocket.ts`

## Decisions

1. **Presence (engine, pure):** `setPresence(state, playerId, connected)` in `lobby.ts`. It flips
   `connected`. If the player who went away is the host, the host passes to the next connected
   human after them in seat order (bots never host). The host role isn't taken back on return.
   It bumps the version and logs a line. It works in lobby and game phases.
2. **Presence (server):**
   - `room:join` with a valid identity tags the socket (`socket.data = { code, playerId }`) and
     marks the player connected.
   - `disconnect` waits a 4 s grace period, so page reloads don't flap the host. After that, if
     the player has no other live socket in the room, they're marked away.
   - All writes go under the room lock, then persist and broadcast. Grace timers are memory-only
     (like bot timers); presence is best-effort after a restart.
3. **Leave in the lobby:** `POST /api/rooms/[code]/leave` (secret-checked) calls `leaveLobby`.
   Host handover picks the first human, never a bot.
4. **Leave in a game:** a new engine action `leaveRoom` is allowed at any time, not only on your
   turn. The player forfeits: bankrupt to the bank (cities return to market), marked away, and
   the host passes on if needed. If it was their turn, play moves to the next player. The winner
   check runs as usual.
5. **Seat colors:** a new player gets the first *unused* token color. This fixes duplicate
   colors after someone leaves the lobby, which would otherwise break decision 6's
   one-color-per-player guarantee.
6. **Lobby locks:** join, bot, bot/remove, settings, start and leave run under `withRoomLock(code)`.
7. **UI:**
   - The lobby ← button leaves (with confirm) and clears the saved seat.
   - The game has a "Leave game" button in the Rules tab (confirm: "you'll forfeit").
   - The player bar already shows AWAY.
8. **Out of scope, unchanged:** a disconnected human whose turn it is still blocks play. Turn
   timers are out of scope for v1, so the lobby host can't kick. I'll flag this in the report.

## Expected files

- `lib/engine/{lobby,engine}.ts` plus tests (`presence.test.ts`)
- `lib/server/socketServer.ts`, `lib/server/gameService.ts` (presence persist helper)
- `app/api/rooms/[code]/{join,bot,bot/remove,settings,start}/route.ts` (lock), `app/api/rooms/[code]/leave/route.ts` (new)
- `app/room/[code]/ui.tsx`, `components/hud/SideCard.tsx`, `app/room/[code]/GameView.tsx`

## Security

- `leaveRoom` and the lobby leave route require the player's secret.
- Presence comes only from a socket that joined with a valid identity.
- No new client data beyond `connected`, which clients already see.

## Acceptance criteria

- [ ] Host closes the tab → after about 4 s the other tab shows the host badge moved and the host
      tagged AWAY. Reopening the tab restores "connected".
- [ ] Lobby leave frees the seat. A new joiner gets an unused color.
- [ ] Game leave → the player is OUT, their cities return to market, play continues or the game ends.
- [ ] Two joins fired at the same moment both land (no lost seat).
- [ ] Verified in the browser: build on a full set, bankruptcy → winner screen, restart mid-game
      (production server on :3100) and the room loads, reconnect resumes.
- [ ] lint, tsc, vitest and build pass.

## Checks

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus automated browser
scenarios (Playwright driving the installed Edge) against `next start -p 3100`.

## Implementation notes (post-build)

- **Restart bug found and fixed** (`hooks/useGameSocket.ts`). On a freshly started server, the
  first page load could hang on "joining table…". The client opened its WebSocket at the same
  moment it asked `/api/socket` to attach Socket.IO, so that first WebSocket hit the server
  before Socket.IO existed and hung until the 20 s connect timeout. Now the client boots the
  socket server first, then connects, with a 5 s connect timeout. Verified on a cold
  `next start`: joined in 1.5 s, and the bot resumed its turn from Postgres state (v16 → v17).
- **Late-identity re-join:** the hook now re-joins with the identity (instead of only
  re-requesting state) so presence tracks seats taken after connect.
- **Legacy saves:** mis-encoded dashes and the crown in old log text are repaired on load
  (`repairText` in `stateCodec.ts`, with a test). The repair table is built from char codes
  so the source stays ASCII.
- **Cleanups:** the `DEMO42` demo room is deleted, and the lint warning in `scripts/sock-test.mjs` is fixed.
- **Still open (by design, v1 scope):** a disconnected human whose turn it is blocks the game.
  Turn timers are out of scope, so others must wait or the player must forfeit.
