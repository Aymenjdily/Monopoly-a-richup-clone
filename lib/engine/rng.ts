/**
 * Deterministic RNG. The engine NEVER calls Math.random(); a Rng is threaded explicitly
 * through applyAction inputs, and only the server creates it (AGENTS.md section 6/8).
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
}

/** mulberry32 — small, fast, good enough distribution for dice. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

/** A deterministic Rng that always produces the given sequence (test helper). */
export function fixedRng(values: number[]): Rng {
  let i = 0;
  return {
    next: () => {
      const v = values[i % values.length];
      i += 1;
      return v;
    },
    int: (min, max) => {
      const v = values[i % values.length];
      i += 1;
      return Math.min(max, Math.max(min, Math.round(v)));
    },
  };
}

export interface DiceRoll {
  die1: number;
  die2: number;
  total: number;
  isDoubles: boolean;
}

export function rollDice(rng: Rng): DiceRoll {
  const die1 = rng.int(1, 6);
  const die2 = rng.int(1, 6);
  return { die1, die2, total: die1 + die2, isDoubles: die1 === die2 };
}
