# Lobby music (synthesized loop, on/off)

Date: 2026-09-27. Requested by the user: "build a lobby music with off and on". This
changes the music scope from out to in (lobby only), so AGENTS.md section 2 is updated. It
follows the earlier choice of synthesized audio with no files.

## Goal

A cheerful, looping background tune in the lobby, made live with the Web Audio API:

- **Melody:** a marimba melody over C–Am–F–G with soft bass, a pad and light hats, 8 bars at 96 BPM.
- **Controls:** a "🎵 Music" on/off pill in the lobby header, remembered per device.
- **Start and stop:** it starts after the first click or key press (autoplay policy), fades out
  when the game starts or you leave the lobby, and pauses while the tab is hidden.

## Files inspected

- `components/sound/sfx.ts` (shared AudioContext), `app/room/[code]/ui.tsx` (lobby header), AGENTS.md section 2

## Decisions

1. `components/sound/music.ts` reuses the sfx `AudioContext` through a new `onAudioReady(fn)`
   helper. It has its own gain node (quiet, about 0.16), independent of the sound-effects
   mute, so either can be off.
2. The score is data (`components/sound/lobbyScore.ts`): 64 eighth-note steps with a melody,
   bass and chords. It's pure and unit-tested (length, every note in key, the loop resolves).
3. A lookahead scheduler (a 25 ms timer that schedules 120 ms ahead) keeps timing sample-accurate.
4. The preference is stored under `dd:music` as `{ on }`, defaulting to on. It's read in try/catch.
5. `useLobbyMusic(active)` in the lobby: `active` is lobby status and the page mounted.
   Leaving the lobby (game start, navigation, unmount) fades out and stops the timer.
6. Only the lobby plays music. The home page and game stay music-free, and the game keeps its sound effects.
7. Debug: `window.__ddMusic` reports `{ playing, steps }` so automated tests can verify without audio.

## Expected files

- `components/sound/{music.ts,lobbyScore.ts,lobbyScore.test.ts,MusicToggle.tsx}` (new)
- `components/sound/sfx.ts` (`onAudioReady`), `app/room/[code]/ui.tsx`, `AGENTS.md`

## Security

Client-only decoration. No state, network or env changes.

## Acceptance criteria

- [ ] In the lobby, music plays after the first interaction; the toggle stops and starts it,
      and the choice survives a reload.
- [ ] Music stops when the game starts, and nothing plays in the game except sound effects.
- [ ] lint, tsc, vitest and build pass; a browser run shows `__ddMusic` playing, then stopped
      after toggling and after start, with no errors.

## Checks

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus a browser run and a
manual listen by the user.
