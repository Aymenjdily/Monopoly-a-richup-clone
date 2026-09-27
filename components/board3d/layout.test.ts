import { describe, expect, it } from "vitest";

import { BOARD_W, CORNER, HALF, place, walkPath, fanOffset } from "./layout";

describe("board3d layout", () => {
  it("fits 9 side tiles plus two corners on every edge", () => {
    expect(BOARD_W).toBeCloseTo(2 * CORNER + 9);
    // first and last side tiles touch their corners
    expect(place(1).x + place(1).w / 2).toBeCloseTo(place(0).x - CORNER / 2);
    expect(place(9).x - place(9).w / 2).toBeCloseTo(place(10).x + CORNER / 2);
    expect(place(29).x + place(29).w / 2).toBeCloseTo(place(30).x - CORNER / 2);
  });

  it("places every tile inside the board and no two tiles on the same spot", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = place(i);
      expect(Math.abs(p.x) + p.w / 2).toBeLessThanOrEqual(HALF + 1e-9);
      expect(Math.abs(p.z) + p.d / 2).toBeLessThanOrEqual(HALF + 1e-9);
      const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("goes clockwise from GO: bottom → left → top → right", () => {
    expect(place(5).side).toBe("bottom");
    expect(place(15).side).toBe("left");
    expect(place(25).side).toBe("top");
    expect(place(35).side).toBe("right");
  });

  it("walks forward tile-by-tile, wrapping past GO", () => {
    expect(walkPath(38, 2)).toEqual([39, 0, 1, 2]);
    expect(walkPath(5, 5)).toEqual([]);
  });

  it("jumps for long or backward moves (jail, cards)", () => {
    expect(walkPath(30, 10)).toEqual([10]);
    expect(walkPath(7, 4)).toEqual([4]);
  });

  it("returns distinct fan offsets for shared tiles", () => {
    const offs = [0, 1, 2, 3].map((k) => fanOffset(k, 4).join(","));
    expect(new Set(offs).size).toBe(4);
  });
});
