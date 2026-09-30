# Roll pacing — the pawn waits for the dice

Date: 2026-09-30. User request: "the thing moves faster before the roll ends, slow it a bit".

## Goal

The pawn should start walking only after the dice have landed, and walk a little slower,
so a roll reads as roll → land → walk. Pure client animation plus bot pacing; no rules change.

## Files inspected

`components/board3d/{DiceRoll,Tokens,GameScene}.tsx`, `lib/server/botRuntime.ts`.

## Decisions

- **Cause:** a new state starts the dice tumble (`ROLL_MS` 750) and the pawn walk (`STEP_MS` 140
  per tile) in the same frame.
- **Shared clock:** `DiceRoll` exports a tiny clock (`diceClock.settleAt`). A new roll sets it to
  now + `ROLL_MS`. `AnimatedPawn` holds any queued walk until `settleAt + 250 ms`. Moves without a
  roll (cards, jail) start at once, as before.
- **Step time:** `STEP_MS` 140 → 200 ms.
- **Bot pacing:** after a bot's roll the next bot move waits for the walk to finish
  (1000 ms + dice + 200 ms per tile) instead of a flat 1000 ms, so the next action doesn't
  cut its own walk short. The timers stay memory-only.

## Security

Client decoration and a server timer only. The server's state is still the truth.

## Acceptance criteria

- [ ] The dice land, then after a short beat the pawn walks, one tile at a time.
- [ ] Bot turns no longer cut their walk short.
- [ ] lint, tsc, vitest and build pass.
