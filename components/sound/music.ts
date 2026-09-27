"use client";

/**
 * Lobby music: the score in lobbyScore.ts played live with Web Audio (no files).
 * Lookahead scheduler (25 ms timer, 120 ms horizon) keeps timing tight. Its own gain node,
 * independent of the sound-effects mute. Decoration only.
 */
import { BPM, CHORDS, MELODY, STEPS_PER_BAR, TOTAL_STEPS, midiToHz } from "./lobbyScore";
import { onAudioReady, unlockAudio } from "./sfx";

const PREF_KEY = "dd:music";
const LEVEL = 0.16;
const STEP_SEC = 60 / BPM / 2; // eighth notes
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let wanted = false; // a lobby asked for music
let on: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

/** Debug hook for automated tests (no audio needed). */
const debug = { playing: false, steps: 0 };
if (typeof window !== "undefined") (window as unknown as { __ddMusic?: typeof debug }).__ddMusic = debug;

export function isMusicOn(): boolean {
  if (on !== null) return on;
  try {
    const raw = localStorage.getItem(PREF_KEY);
    on = raw ? Boolean((JSON.parse(raw) as { on?: boolean }).on) : true;
  } catch {
    on = true;
  }
  return on;
}

export function setMusicOn(value: boolean): void {
  on = value;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ on: value }));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(value));
  if (value && wanted) {
    unlockAudio();
    begin();
  } else if (!value) {
    halt();
  }
}

export function subscribeMusic(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── voices ──────────────────────────────────────────────────────────────────────
function note(freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + dur + 0.03);
}

function hat(at: number) {
  if (!ctx || !bus) return;
  // tiny high click: very short square blip through a highpass
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = 7200;
  f.type = "highpass";
  f.frequency.value = 6000;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.03, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  o.connect(f).connect(g).connect(bus);
  o.start(at);
  o.stop(at + 0.05);
}

function scheduleStep(s: number, at: number) {
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const chord = CHORDS[bar];
  // melody: marimba (fundamental + soft 4th harmonic)
  const m = MELODY[s];
  if (m !== null) {
    note(midiToHz(m), at, 0.42, 0.34);
    note(midiToHz(m) * 4, at, 0.12, 0.05);
  }
  // bass on beats 1 and 3 (root, then fifth)
  if (inBar === 0) note(midiToHz(chord.bass), at, STEP_SEC * 3.5, 0.3, "triangle");
  if (inBar === 4) note(midiToHz(chord.bass + 7), at, STEP_SEC * 3.5, 0.24, "triangle");
  // warm pad: the triad, once per bar
  if (inBar === 0) chord.pad.forEach((p) => note(midiToHz(p), at, STEP_SEC * 7.5, 0.05, "triangle"));
  // off-beat hats
  if (inBar % 2 === 1) hat(at);
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(step, nextTime);
    step = (step + 1) % TOTAL_STEPS;
    debug.steps++;
    nextTime += STEP_SEC;
  }
}

function begin() {
  if (!wanted || !isMusicOn() || timer) return;
  onAudioReady((c) => {
    if (!wanted || !isMusicOn() || timer) return;
    ctx = c;
    if (!bus) {
      bus = c.createGain();
      bus.gain.value = 0;
      bus.connect(c.destination);
    }
    if (c.state === "suspended") void c.resume();
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setTargetAtTime(LEVEL, c.currentTime, 0.4); // gentle fade-in
    nextTime = c.currentTime + 0.1;
    step = 0;
    timer = setInterval(tick, TICK_MS);
    debug.playing = true;
  });
}

function halt() {
  if (timer) clearInterval(timer);
  timer = null;
  debug.playing = false;
  if (ctx && bus) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.15); // fade out
}

/** Called by the lobby: start (if enabled) when active, fade out when not. */
export function setLobbyMusicActive(active: boolean): void {
  wanted = active;
  if (active) begin();
  else halt();
}

if (typeof document !== "undefined") {
  // pause while the tab is hidden (timers get throttled there anyway)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) halt();
    else if (wanted) begin();
  });
}
