# Sound effects (synthesized)

Date: 2026-09-27. Scope change approved by the user: **sound effects only, no music,
synthesized in code** (answers to the scope question). AGENTS.md section 2 is updated to match.

## Goal

The game gets short, toy-like sound effects, generated live with the Web Audio API (no
audio files):

- **Moves and dice:** pawn steps (one per tile, synced to the walk), dice roll.
- **Money and property:** buying, paying and receiving rent, passing GO, building, mortgaging.
- **Events:** jail, card draw, "your turn" chime, win fanfare, bankruptcy, a rejected-action buzz and UI clicks.

A mute toggle and a volume slider live in the game HUD and are remembered per device. Sound
is decoration only and never affects game state.

## Files inspected

- `app/room/[code]/GameView.tsx`, `components/hud/*`, `components/board3d/{Tokens,DiceRoll}.tsx`
- `components/hud/history.ts` (log classification), `lib/engine/{money,engine}.ts` (log text and amounts)
- AGENTS.md sections 2, 6 and 7

## Decisions

1. `components/sound/sfx.ts` is a client-only singleton.
   - The `AudioContext` is created lazily on the first user gesture (browser autoplay policy).
   - A master gain applies volume and mute, and `play(name)` never throws.
   - Preferences live in `localStorage` under `dd:sound`, wrapped in try/catch.
2. Recipes are small oscillator and noise envelopes, each under about 0.9 s. There's no
   randomness in the recipes (fixed patterns), which keeps AGENTS.md's no-client-randomness
   rule simple.
3. The mapping from engine log to sound is a pure function, `soundForEvent(entry, meName)`, in
   `components/sound/events.ts`, and it's unit-tested. Rent is signed from the viewer's side:
   "rentGet" if I receive, "rentPay" if I pay, and a neutral "coin" for bystanders.
4. Triggers:
   - **Steps:** played in `AnimatedPawn` when each walk segment starts, so they stay in sync.
   - **Dice:** played when the `DiceRoll` animation starts.
   - **Everything else:** `useGameSounds(state, myId)` plays sounds for log entries newer than
     the last one seen. The first snapshot (load or reconnect) is silent, and each state update
     is capped at 4 sounds.
   - **Your turn:** a chime when the turn passes to me.
   - **Clicks and errors:** UI clicks on HUD buttons, and a buzz on the error toast.
5. A small speaker button with a volume slider sits at the top right of the game screen.
6. A tiny debug ring buffer (`window.__ddSfx`, the last 50 names) lets tests verify triggers without audio.

## Expected files

- `components/sound/{sfx.ts,events.ts,events.test.ts,useGameSounds.ts,SoundToggle.tsx}` (new)
- `components/board3d/{Tokens,DiceRoll}.tsx`, `app/room/[code]/GameView.tsx`, `components/hud/*` (click hooks)
- `AGENTS.md` (scope), `vitest.config.ts` (already includes `components/**`)

## Security

Client-only. No new data or state, no network or env vars, and nothing is persisted except
the local preference.

## Acceptance criteria

- [ ] Sounds play for each listed event. Nothing plays on first load or reconnect.
- [ ] Mute and volume persist across reloads.
- [ ] Unit tests for the event → sound mapping.
- [ ] lint, tsc, vitest and build pass; a browser run shows the expected `__ddSfx` sequence and no errors.

## Checks / manual test

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`. In the browser, roll,
buy, pass GO and mute, and confirm by ear. The automated run checks `window.__ddSfx`.
