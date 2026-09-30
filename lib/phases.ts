export type PhaseStatus =
  | "not started"
  | "prompt awaiting approval"
  | "approved"
  | "in progress"
  | "done";

export interface Phase {
  index: number;
  name: string;
  status: PhaseStatus;
  designGate: boolean;
}

export const PHASES: Phase[] = [
  { index: 0, name: "Scaffold", status: "done", designGate: false },
  { index: 1, name: "Engine core", status: "done", designGate: false },
  { index: 2, name: "Full rules", status: "done", designGate: false },
  { index: 3, name: "Rooms + persistence", status: "done", designGate: false },
  { index: 4, name: "Real-time sync", status: "done", designGate: false },
  { index: 5, name: "3D board", status: "done", designGate: true },
  { index: 6, name: "Game HUD", status: "done", designGate: true },
  { index: 7, name: "Full loop + polish", status: "done", designGate: true },
  { index: 8, name: "In-game guide", status: "done", designGate: true },
  { index: 9, name: "Restyle: felt table", status: "done", designGate: true },
  { index: 10, name: "Jev bots + personalities", status: "done", designGate: false },
];

export const phasesList: Phase[] = PHASES;
