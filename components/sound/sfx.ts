"use client";

/**
 * Synthesized sound effects (Web Audio API, no audio files). Decoration only — nothing
 * here touches game state. The AudioContext is created lazily on the first user gesture
 * (browser autoplay policy); every call is safe to make at any time and never throws.
 */

export type SfxName =
  | "click"
  | "step"
  | "dice"
  | "buy"
  | "rentPay"
  | "rentGet"
  | "coin"
  | "go"
  | "jail"
  | "card"
  | "build"
  | "mortgage"
  | "tax"
  | "turn"
  | "win"
  | "bankrupt"
  | "error";

export interface SoundPrefs {
  muted: boolean;
  /** 0..1 */
  volume: number;
}

const PREFS_KEY = "dd:sound";
const DEFAULT_PREFS: SoundPrefs = { muted: false, volume: 0.7 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let prefs: SoundPrefs = DEFAULT_PREFS;
let prefsLoaded = false;
const listeners = new Set<(p: SoundPrefs) => void>();

/** Debug ring buffer so automated tests can verify triggers without hearing them. */
const recent: string[] = [];

function loadPrefs(): SoundPrefs {
  if (prefsLoaded) return prefs;
  prefsLoaded = true;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SoundPrefs>;
      prefs = {
        muted: Boolean(p.muted),
        volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : DEFAULT_PREFS.volume,
      };
    }
  } catch {
    /* private mode / blocked storage: keep defaults */
  }
  return prefs;
}

export function getSoundPrefs(): SoundPrefs {
  return loadPrefs();
}

export function setSoundPrefs(next: Partial<SoundPrefs>): void {
  prefs = { ...loadPrefs(), ...next };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  if (master && ctx) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn(prefs));
}

export function subscribeSoundPrefs(fn: (p: SoundPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const readyQueue: ((c: AudioContext) => void)[] = [];

/**
 * Runs `fn` with the shared AudioContext as soon as audio is unlocked (immediately if it
 * already is). Used by the lobby music so there is only ever one context.
 */
export function onAudioReady(fn: (c: AudioContext) => void): void {
  if (ctx) fn(ctx);
  else readyQueue.push(fn);
}

/** Creates/resumes the audio graph. Call from a user gesture (done automatically below). */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = loadPrefs().muted ? 0 : prefs.volume;
      // gentle bus compression keeps stacked effects from clipping
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      const ready = [...readyQueue];
      readyQueue.length = 0;
      queueMicrotask(() => ready.forEach((fn) => ctx && fn(ctx)));
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      // fixed-seed LCG: deterministic "noise", no Math.random needed
      let seed = 1234567;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x7fffffff) * 2 - 1;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

if (typeof window !== "undefined") {
  const once = () => unlockAudio();
  window.addEventListener("pointerdown", once, { passive: true });
  window.addEventListener("keydown", once);
  (window as unknown as { __ddSfx?: string[] }).__ddSfx = recent;
}

// ── tiny synth helpers ──────────────────────────────────────────────────────────
function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; attack?: number } = {}) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + (opts.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Marimba-ish note: fundamental + quiet 4th harmonic, quick decay. */
function mallet(freq: number, at: number, dur = 0.35, gain = 0.28) {
  tone(freq, at, dur, { gain });
  tone(freq * 4, at, dur * 0.35, { gain: gain * 0.18 });
}

function noise(at: number, dur: number, opts: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType; sweepTo?: number } = {}) {
  if (!ctx || !master || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.setValueAtTime(opts.freq ?? 2000, at);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, at + dur);
  f.Q.value = opts.q ?? 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master);
  src.start(at, (at * 7.31) % 0.8);
  src.stop(at + dur + 0.02);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A4 = 440, E4 = 329.63;

const RECIPES: Record<SfxName, (t: number, v: number) => void> = {
  click: (t) => tone(880, t, 0.05, { type: "triangle", gain: 0.12 }),
  // soft wooden knock; alternates pitch so a walk sounds like footsteps
  step: (t, v) => {
    tone(v % 2 ? 420 : 380, t, 0.08, { type: "triangle", gain: 0.2, to: 220 });
    noise(t, 0.03, { freq: 3200, gain: 0.05 });
  },
  dice: (t) => {
    [0, 0.07, 0.15, 0.22, 0.31, 0.39, 0.5].forEach((d, i) => {
      noise(t + d, 0.045, { freq: 2400 + (i % 3) * 700, q: 3, gain: 0.22 - i * 0.02 });
      tone(900 + (i % 4) * 140, t + d, 0.03, { type: "square", gain: 0.03 });
    });
  },
  buy: (t) => {
    noise(t, 0.05, { freq: 5000, q: 2, gain: 0.12 });
    mallet(1318.5, t + 0.03, 0.4, 0.22);
    mallet(1760, t + 0.1, 0.55, 0.22);
  },
  rentPay: (t) => {
    mallet(E5, t, 0.25);
    mallet(A4, t + 0.12, 0.4);
  },
  rentGet: (t) => {
    mallet(C5, t, 0.25);
    mallet(G5, t + 0.1, 0.45);
  },
  coin: (t) => mallet(1174.7, t, 0.25, 0.14),
  go: (t) => [C5, E5, G5, C6].forEach((f, i) => mallet(f, t + i * 0.075, 0.4, 0.22)),
  jail: (t) => {
    tone(110, t, 0.35, { type: "sawtooth", gain: 0.09, to: 82 });
    noise(t + 0.02, 0.18, { freq: 700, q: 6, gain: 0.25 });
    noise(t + 0.2, 0.12, { freq: 900, q: 8, gain: 0.18 });
  },
  card: (t) => noise(t, 0.28, { freq: 900, sweepTo: 5200, q: 0.8, gain: 0.16 }),
  build: (t) => {
    tone(300, t, 0.07, { type: "triangle", gain: 0.25, to: 180 });
    tone(360, t + 0.12, 0.07, { type: "triangle", gain: 0.25, to: 200 });
    mallet(G5, t + 0.2, 0.3, 0.14);
  },
  mortgage: (t) => {
    mallet(E4, t, 0.35, 0.2);
    mallet(E4 * 1.5, t + 0.1, 0.3, 0.1);
  },
  tax: (t) => {
    mallet(A4, t, 0.2);
    mallet(E4, t + 0.1, 0.35);
  },
  turn: (t) => {
    tone(987.8, t, 0.9, { gain: 0.16 });
    tone(1975.5, t, 0.5, { gain: 0.05 });
    tone(1318.5, t + 0.12, 0.8, { gain: 0.12 });
  },
  win: (t) => {
    [C5, E5, G5, C6].forEach((f, i) => mallet(f, t + i * 0.11, 0.5, 0.24));
    [C5, E5, G5].forEach((f) => tone(f, t + 0.5, 0.9, { type: "triangle", gain: 0.1 }));
  },
  bankrupt: (t) => [392, 370, 349.2, 311.1].forEach((f, i) => tone(f, t + i * 0.22, i === 3 ? 0.7 : 0.24, { type: "sawtooth", gain: 0.07, to: i === 3 ? 260 : undefined })),
  error: (t) => {
    tone(196, t, 0.09, { type: "square", gain: 0.06 });
    tone(165, t + 0.11, 0.12, { type: "square", gain: 0.06 });
  },
};

let stepCount = 0;

/** Plays a named effect. Silently does nothing when muted, locked or unsupported. */
export function playSfx(name: SfxName, delayMs = 0): void {
  recent.push(name);
  if (recent.length > 50) recent.shift();
  if (typeof window === "undefined" || loadPrefs().muted) return;
  if (!ctx) return; // not unlocked by a gesture yet
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + 0.01 + delayMs / 1000;
    RECIPES[name](t, name === "step" ? stepCount++ : 0);
  } catch {
    /* audio is decoration: never break the game */
  }
}
