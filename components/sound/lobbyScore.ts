/**
 * The lobby tune as data: 8 bars × 8 eighth-notes = 64 steps at 96 BPM, C–Am–F–G.
 * Melody stays in C major pentatonic so it never clashes; the last phrase resolves to C
 * so the loop point feels natural. Notes are MIDI numbers (60 = middle C), null = rest.
 */
export const BPM = 96;
export const STEPS_PER_BAR = 8;

type N = number | null;
const _ = null;

/** One chord per bar: pad triad + bass root. */
export const CHORDS: { name: string; pad: [number, number, number]; bass: number }[] = [
  { name: "C", pad: [60, 64, 67], bass: 36 },
  { name: "Am", pad: [57, 60, 64], bass: 33 },
  { name: "F", pad: [53, 57, 60], bass: 29 },
  { name: "G", pad: [55, 59, 62], bass: 31 },
  { name: "C", pad: [60, 64, 67], bass: 36 },
  { name: "Am", pad: [57, 60, 64], bass: 33 },
  { name: "F", pad: [53, 57, 60], bass: 29 },
  { name: "G", pad: [55, 59, 62], bass: 31 },
];

// prettier-ignore
export const MELODY: N[] = [
  76, _, 79, _, 84, _, 79, 76,   // C   — phrase A
  81, _, 76, _, 72, _, 74, 76,   // Am
  72, _, 69, _, 72, 74, 76, _,   // F
  74, _, 79, _, 74, _, 67, _,    // G
  76, 79, 84, _, 81, 79, 76, _,  // C   — phrase B
  81, _, 84, _, 81, 79, 76, _,   // Am
  72, 74, 76, _, 79, _, 76, 74,  // F
  74, _, 72, _, 67, _, 72, _,    // G → resolves to C
];

export const TOTAL_STEPS = CHORDS.length * STEPS_PER_BAR;

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
