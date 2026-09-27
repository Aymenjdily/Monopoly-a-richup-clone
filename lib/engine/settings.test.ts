import { describe, expect, it } from "vitest";

import { applyAction } from "./engine";
import { addBot, joinLobby, lobbyState, startGame } from "./lobby";
import { canBuild, rentDue } from "./ownershipRules";
import { fixedRng, mulberry32 } from "./rng";
import { DEFAULT_SETTINGS, parseSettingsPatch, settingsOf, updateSettings, type RoomSettings } from "./settings";
import { createState, type GameState } from "./types";

const SAFE_DECKS = {
  chance: [9, 6, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0],
  chest: [19, 20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21],
};

function makeGame(settings: Partial<RoomSettings> = {}): GameState {
  const state = createState([
    { id: "p1", name: "Alice", colorToken: "#ff0000" },
    { id: "p2", name: "Bob", colorToken: "#00ff00" },
  ]);
  state.decks = { chance: [...SAFE_DECKS.chance], chest: [...SAFE_DECKS.chest] };
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  state.pot = 0;
  return state;
}

const p = (s: GameState, id: string) => s.players.find((x) => x.id === id)!;
const roll = (s: GameState, dice: [number, number]) =>
  applyAction({ state: s, playerId: "p1", action: { type: "roll" }, rng: fixedRng(dice) });

describe("settings validation", () => {
  it("accepts whitelisted values", () => {
    const r = parseSettingsPatch({ startCash: 2000, goSalary: 300, maxPlayers: 4, parkingJackpot: true });
    expect(r).toEqual({ ok: true, patch: { startCash: 2000, goSalary: 300, maxPlayers: 4, parkingJackpot: true } });
  });

  it("rejects unknown keys and out-of-range values", () => {
    expect(parseSettingsPatch({ startCash: 1234 }).ok).toBe(false);
    expect(parseSettingsPatch({ goSalary: 1e9 }).ok).toBe(false);
    expect(parseSettingsPatch({ maxPlayers: 7 }).ok).toBe(false);
    expect(parseSettingsPatch({ maxPlayers: 1 }).ok).toBe(false);
    expect(parseSettingsPatch({ rentInJail: "yes" }).ok).toBe(false);
    expect(parseSettingsPatch({ auctions: true }).ok).toBe(false);
    expect(parseSettingsPatch(null).ok).toBe(false);
  });

  it("old saved games without settings read as the standard defaults", () => {
    expect(settingsOf({})).toEqual(DEFAULT_SETTINGS);
  });
});

describe("lobby settings", () => {
  it("updates only in the lobby and bumps the version", () => {
    const s = lobbyState({ id: "h", name: "Host" });
    const v = s.version;
    updateSettings(s, { goSalary: 300 });
    expect(settingsOf(s).goSalary).toBe(300);
    expect(s.version).toBe(v + 1);
    joinLobby(s, { id: "g", name: "Guest" });
    startGame(s, mulberry32(1));
    expect(() => updateSettings(s, { goSalary: 100 })).toThrow(/locked/);
  });

  it("max players limits joins and can't drop below the seated count", () => {
    const s = lobbyState({ id: "h", name: "Host" });
    updateSettings(s, { maxPlayers: 2 });
    joinLobby(s, { id: "g", name: "Guest" });
    expect(() => addBot(s, "b1")).toThrow(/full/);
    expect(() => joinLobby(s, { id: "x", name: "X" })).toThrow(/full/);
    const t = lobbyState({ id: "h", name: "Host" });
    joinLobby(t, { id: "a", name: "A" });
    joinLobby(t, { id: "b", name: "B" });
    expect(() => updateSettings(t, { maxPlayers: 2 })).toThrow(/below/);
  });

  it("applies starting cash to every player at start", () => {
    const s = lobbyState({ id: "h", name: "Host" });
    joinLobby(s, { id: "g", name: "Guest" });
    updateSettings(s, { startCash: 2500 });
    startGame(s, mulberry32(7));
    expect(s.players.map((x) => x.money)).toEqual([2500, 2500]);
  });

  it("random order shuffles seats with the server RNG (colors keep join order)", () => {
    const orderFor = (seed: number, randomOrder: boolean) => {
      const s = lobbyState({ id: "a", name: "A" });
      for (const id of ["b", "c", "d", "e"]) joinLobby(s, { id, name: id });
      updateSettings(s, { randomOrder });
      startGame(s, mulberry32(seed));
      return s.players.map((x) => `${x.id}:${x.colorToken}`);
    };
    const fixed = orderFor(3, false);
    expect(fixed.map((x) => x.split(":")[0])).toEqual(["a", "b", "c", "d", "e"]);
    const shuffledOrders = [1, 2, 3, 4, 5].map((seed) => orderFor(seed, true));
    expect(shuffledOrders.some((o) => o.join() !== fixed.join())).toBe(true);
    for (const o of shuffledOrders) expect([...o].sort()).toEqual([...fixed].sort());
    // deterministic for the same seed
    expect(orderFor(4, true)).toEqual(orderFor(4, true));
  });
});

describe("rule toggles in play", () => {
  it("pays the configured GO salary when passing GO", () => {
    const s = makeGame({ goSalary: 300 });
    p(s, "p1").position = 38;
    const before = p(s, "p1").money;
    const r = roll(s, [2, 3]); // 38 → 3, passes GO
    expect(p(r.state, "p1").money).toBe(before + 300);
  });

  it("exact GO bonus pays double only when enabled", () => {
    for (const [on, expected] of [[false, 200], [true, 400]] as const) {
      const s = makeGame({ exactGoBonus: on });
      p(s, "p1").position = 33;
      const before = p(s, "p1").money;
      const r = roll(s, [3, 4]); // 33 → 0, lands exactly on GO
      expect(p(r.state, "p1").position).toBe(0);
      expect(p(r.state, "p1").money - before).toBe(expected);
    }
  });

  it("Free Parking jackpot collects taxes and pays out on Parking", () => {
    const s = makeGame({ parkingJackpot: true });
    p(s, "p1").position = 1;
    const r = roll(s, [1, 2]); // 1 → 4 Income Tax 200
    expect(r.state.pot).toBe(200);

    const t = makeGame({ parkingJackpot: true });
    t.pot = 150;
    p(t, "p1").position = 13;
    const before = p(t, "p1").money;
    const r2 = roll(t, [3, 4]); // 13 → 20 Free Parking
    expect(p(r2.state, "p1").money).toBe(before + 150);
    expect(r2.state.pot).toBe(0);

    const off = makeGame({ parkingJackpot: false });
    p(off, "p1").position = 1;
    expect(roll(off, [1, 2]).state.pot ?? 0).toBe(0);
  });

  it("rent while in jail can be switched off", () => {
    for (const [allowed, kind] of [[true, "rent"], [false, "none"]] as const) {
      const s = makeGame({ rentInJail: allowed });
      s.ownership[21] = { ownerId: "p2", houses: 0, mortgaged: false };
      p(s, "p2").inJail = true;
      p(s, "p2").position = 10;
      expect(rentDue(s, 21, 7).kind).toBe(kind);
    }
  });

  it("owners never pay rent to themselves (regression)", () => {
    const s = makeGame();
    s.ownership[11] = { ownerId: "p1", houses: 0, mortgaged: false }; // Phuket, owned by the roller
    p(s, "p1").position = 4;
    const before = p(s, "p1").money;
    const r = roll(s, [3, 4]); // 4 → 11
    expect(p(r.state, "p1").position).toBe(11);
    expect(p(r.state, "p1").money).toBe(before);
    expect(r.state.log.some((e) => /rent to Alice/.test(e.text))).toBe(false);
  });

  it("even building can be switched off", () => {
    for (const [even, ok] of [[true, false], [false, true]] as const) {
      const s = makeGame({ evenBuilding: even });
      for (const i of [16, 18, 19]) s.ownership[i] = { ownerId: "p1", houses: 0, mortgaged: false };
      s.ownership[16].houses = 1; // 16 already ahead of its set
      expect(canBuild(s, "p1", 16).ok).toBe(ok);
    }
  });
});
