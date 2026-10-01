# Flat (top-down) view toggle

## Goal

Let each player switch the in-game board between the current angled **3D** view and a
**Flat** top-down view with one HUD button. Flat is the same WebGL scene (board, tokens, houses,
dice) seen straight from above with rotation locked. It is a camera mode, not a second 2D board.
The choice is cosmetic, client-only and remembered per device.

## Files inspected

- `components/board3d/GameScene.tsx` (camera constants, `CameraRig`, OrbitControls limits)
- `components/board3d/SceneBase.tsx`
- `app/room/[code]/GameView.tsx` (HUD layout: `SoundToggle` top-right on desktop, stacked on small screens)
- `components/sound/SoundToggle.tsx`, `components/sound/sfx.ts` (per-device prefs in localStorage, key `dd:sound`)

## Decisions and assumptions

- **Flat = top-down camera on the existing 3D scene.** AGENTS.md decision 10 says "No 2D fallback
  board in v1", so I won't build a separate DOM/SVG board. This keeps one renderer and one source of truth.
- Flat mode: camera directly above the board centre (polar angle ~0, tiny epsilon so OrbitControls
  stays stable), board edges aligned to the screen, rotation disabled, zoom still allowed within limits,
  no pan (same as now). It honours the existing narrow-screen pull-back and the desktop side-panel shift.
- 3D mode is exactly today's camera (constants and limits unchanged). The default is 3D.
- The camera eases between modes over ~0.4 s instead of snapping. This is decoration only.
- Pref is stored in localStorage key `dd:view` (`"3d" | "flat"`), wrapped in try/catch, like the sound prefs.
- Only the in-game board gets the toggle. The home and lobby scenes don't change.

## Expected files

- `components/board3d/GameScene.tsx`: new `view?: "3d" | "flat"` prop; `CameraRig` picks the pose and limits per view.
- `components/board3d/viewPref.ts` (new): get/set/subscribe for the per-device view pref.
- `components/hud/ViewToggle.tsx` (new): pill button "🎲 3D / ▦ Flat", same look as `SoundToggle`.
- `app/room/[code]/GameView.tsx`: hold the view state, pass it to `GameScene`, render `ViewToggle` beside `SoundToggle` (desktop and small screens).

## Requirements

1. The toggle switches the view immediately for the current player only. No socket or server traffic.
2. The choice survives reload (same device).
3. In Flat, the whole board is visible at desktop and phone sizes, and tile clicks still open the deed card.
4. 3D view is pixel-identical to today when the toggle is on 3D.
5. The button is reachable (pointer-events) and doesn't overlap existing HUD elements.

## Security considerations

None new. It's purely client rendering with no server, engine, state or protocol change.
The server-vs-client boundary (section 6) is untouched.

## Acceptance criteria

- Clicking the toggle moves the camera to top-down, and clicking again moves it back to the original angle.
- Reload keeps the last choice.
- Rotating isn't possible in Flat; zoom works; tiles stay clickable.
- lint, tsc, vitest, and build all pass.

## Checks

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`

## Manual test

1. `npm run dev`, create a room, add a bot, and start.
2. Toggle Flat: the board is seen from above, fully in view; click a property and the deed card opens.
3. Reload and confirm it's still Flat. Toggle back to 3D and confirm the original angle.
4. Narrow the window to phone width and confirm the board fits and the button is visible.
