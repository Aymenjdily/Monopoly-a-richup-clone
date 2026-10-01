/** Board camera mode, remembered per device (cosmetic only — never sent to the server). */
export type BoardView = "3d" | "flat";

const KEY = "dd:view";
const listeners = new Set<(v: BoardView) => void>();

export function getBoardView(): BoardView {
  try {
    return localStorage.getItem(KEY) === "flat" ? "flat" : "3d";
  } catch {
    return "3d"; // private mode / blocked storage
  }
}

export function setBoardView(view: BoardView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(view));
}

export function subscribeBoardView(fn: (v: BoardView) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
