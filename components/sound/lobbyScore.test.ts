import { describe, expect, it } from "vitest";

import { CHORDS, MELODY, STEPS_PER_BAR, TOTAL_STEPS, midiToHz } from "./lobbyScore";

describe("lobby score", () => {
  it("is 8 full bars of eighth notes", () => {
    expect(TOTAL_STEPS).toBe(64);
    expect(MELODY).toHaveLength(CHORDS.length * STEPS_PER_BAR);
  });

  it("keeps the melody in C major pentatonic (never clashes with the chords)", () => {
    const pentatonic = new Set([0, 2, 4, 7, 9]);
    for (const n of MELODY) if (n !== null) expect(pentatonic.has(n % 12)).toBe(true);
  });

  it("resolves to C at the loop point", () => {
    const last = [...MELODY].reverse().find((n) => n !== null);
    expect(last! % 12).toBe(0);
  });

  it("converts MIDI to frequency", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(60)).toBeCloseTo(261.63, 1);
  });
});
