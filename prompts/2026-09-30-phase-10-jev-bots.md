# Phase 10 — Smarter bots with Jev (TypeSafe AI)

Date: 2026-09-30. Approved by the user: Jev for bot decisions on the server, bot
personalities picked by the host, and a rule-based fallback on low confidence or failure.
Scope change: bots may now build and unmortgage; one new server-only env var.

## Goal

On a bot's turn the engine lists the legal moves. A "brain" picks one:

- **Jev** (`POST https://api.typesafe.ai/v1/systemone`, a `choice` question) when
  `TYPESAFE_API_KEY` is set and the call is fast and confident.
- **The rule-based brain** otherwise, built on the advisor logic.

Each bot has a personality (cautious, balanced or aggressive), chosen by the host when
adding it. The personality shapes both brains.

## Files inspected

`lib/engine/{bots,advisor,lobby,types,ownershipRules}.ts`, `lib/server/botRuntime.ts`,
`app/api/rooms/[code]/bot/route.ts`, `components/board3d/LobbyStage.tsx`, `components/ui/SeatList.tsx`,
TypeSafe docs (API reference, JS SDK page, primitives index).

## Decisions

1. **The engine stays pure.** `lib/engine/bots.ts` gains:
   - `botOptions(state)`: the legal moves for the acting bot, each with an id, the engine
     action, a label and a one-line fact summary.
   - `botChooseRules(state)`: the rule brain, reserve-aware and personality-aware.
   - `botChoose` stays as the entry point that tests use.
2. **Bot moves now include:** buy / decline, roll, pay jail fine, use card, build (the best
   next house per full set), unmortgage, and end turn. Mortgaging under pressure stays with
   the engine's automatic liquidation.
3. **Jev lives in `lib/server/botBrain.ts`** (server only):
   - It sends a compact text state (personality, cash, position, holdings, rivals' threats)
     and one `choice` question whose criteria are the option ids.
   - The answer must be one of the ids. Otherwise, or on `confidence < 0.3`, timeout
     (1500 ms), a non-200 response or a missing key, it returns the rule brain's pick.
   - It's skipped entirely when there's only one option (for example "roll").
   - Plain `fetch`, no SDK dependency.
4. **Locking.** The Jev call happens outside the room lock. Inside the lock the runtime
   re-reads the state and only applies the action if the version is unchanged, so a slow
   model never blocks the room.
5. **Personality** is `Player.botStyle?: "cautious" | "balanced" | "aggressive"` (public,
   optional, default balanced). `addBot(state, id, style)`; the API route validates it; the
   lobby shows a three-way picker on "Add bot" and a style tag on the seat.
6. **AGENTS.md** is updated: bot scope, decision 13, and env var `TYPESAFE_API_KEY`
   (server-only, never in client code).

## Security

- The key is read only in `lib/server/botBrain.ts`. It's never sent to the client, never
  logged, and `.env` stays uncommitted.
- Only public game facts go to Jev: no player secrets, no deck order, no RNG.
- The model can only select among engine-generated legal actions, and the engine validates again.

## Acceptance criteria

- [x] Unit tests: the options list per phase, the rule brain per personality, and the Jev
      brain with a fake fetch (valid pick, invalid id, low confidence, timeout/HTTP error → fallback).
- [x] A live call with the real key returns a valid choice (script).
- [x] A browser game with bots of each style plays turns; bots build when they own a set
      (building is proven by whole-game simulations in `bots.test.ts`; short browser games
      ended before any bot completed a set).
- [x] Without the key everything still works.
- [x] lint, tsc, vitest and build pass.

## Implementation notes (post-build)

- **Lobby picker:** `components/ui/AddBot.tsx`. "＋ Add bot" opens Cautious / Balanced /
  Aggressive; seats show a "CAUTIOUS BOT"-style tag (stage and phone grid).
- **Server log:** one line per real decision, e.g. `[bot] RW4R4P Dice Bot (cautious) -> buy via jev 0.82`
  or `via rules (low-confidence)`. It never includes the key or any secrets.
- **Tuning:** the first live game had the cautious bot passing on everything. The personality
  briefs now state each reserve in dollars, and the buy option shows "cash left". After that
  the cautious bot bought 8 times in 18 rolls.
- **Live results:** Jev answers in about 0.3–0.7 s. In the last run 18 of 20 decisions came from Jev and 2 were
  low-confidence fallbacks.
