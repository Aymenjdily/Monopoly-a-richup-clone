import { describe, expect, it } from "vitest";

import { RESERVE, advise, rollOdds } from "./advisor";
import { DEFAULT_SETTINGS } from "./settings";
import { createState, type GameState, type OwnershipEntry } from "./types";

const own = (ownerId: string, houses = 0, mortgaged = false): OwnershipEntry => ({ ownerId, houses, mortgaged });

function game(): GameState {
  const s = createState([
    { id: "me", name: "Sasha", colorToken: "#e5484d" },
    { id: "bob", name: "Bob", colorToken: "#f5a623" },
  ]);
  s.settings = { ...DEFAULT_SETTINGS };
  return s;
}
function pendingBuy(s: GameState, idx: number, price: number) {
  s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: true };
  s.pending = { type: "buy", spaceIndex: idx, price };
}
const buyTag = (s: GameState) => advise(s, "me").now[0].tag?.label;

describe("advisor — buying", () => {
  it("says MUST BUY when it completes a set", () => {
    const s = game();
    s.ownership[21] = own("me");
    s.ownership[23] = own("me");
    pendingBuy(s, 24, 240); // Istanbul completes red
    expect(buyTag(s)).toBe("MUST BUY");
  });

  it("says BLOCK when a rival owns the rest of the set", () => {
    const s = game();
    s.ownership[21] = own("bob");
    s.ownership[23] = own("bob");
    pendingBuy(s, 24, 240);
    expect(buyTag(s)).toBe("BLOCK");
  });

  it("says GOOD BUY for a fresh set with cash to spare, RISKY below the reserve, CAN'T AFFORD when short", () => {
    const s = game();
    pendingBuy(s, 24, 240);
    expect(buyTag(s)).toBe("GOOD BUY");
    s.players[0].money = 240 + RESERVE - 1;
    expect(buyTag(s)).toBe("RISKY");
    s.players[0].money = 100;
    expect(buyTag(s)).toBe("CAN'T AFFORD");
    expect(advise(s, "me").now[0].actions?.map((a) => a.type)).toEqual(["decline"]);
  });

  it("rates railways well and utilities as optional", () => {
    const s = game();
    pendingBuy(s, 5, 200);
    expect(buyTag(s)).toBe("GOOD BUY");
    pendingBuy(s, 12, 150);
    expect(buyTag(s)).toBe("OPTIONAL");
  });
});

describe("advisor — upgrades", () => {
  it("suggests building on a full set, respecting even building, with rent before/after", () => {
    const s = game();
    for (const i of [16, 18, 19]) s.ownership[i] = own("me");
    s.ownership[16].houses = 1;
    const up = advise(s, "me").upgrade[0];
    expect(up.tag?.label).toBe("BEST VALUE");
    const target = up.actions?.[0].spaceIndex;
    expect([18, 19]).toContain(target); // not 16: it's already ahead
    expect(up.detail).toMatch(/rent \$\d+ → \$\d+/);
  });

  it("allows any tile when even building is off", () => {
    const s = game();
    s.settings = { ...DEFAULT_SETTINGS, evenBuilding: false };
    for (const i of [37, 39]) s.ownership[i] = own("me");
    s.ownership[39].houses = 2; // New York already ahead — still the best gain
    expect(advise(s, "me").upgrade[0].actions?.[0].spaceIndex).toBe(39);
  });

  it("tells you to save up when you can't keep the reserve, and points at the nearest set otherwise", () => {
    const s = game();
    for (const i of [37, 39]) s.ownership[i] = own("me");
    s.players[0].money = 250;
    const up = advise(s, "me").upgrade[0];
    expect(up.actions).toBeUndefined();
    expect(up.detail).toMatch(/Save up \$\d+ more/);

    const t = game();
    t.ownership[6] = own("me"); // one of Japan's three
    expect(advise(t, "me", { groupLabel: () => "Japan" }).upgrade[0].title).toBe("2 cities away from Japan");
  });

  it("suggests unmortgaging a city inside a full set first", () => {
    const s = game();
    for (const i of [1, 3]) s.ownership[i] = own("me");
    s.ownership[3].mortgaged = true;
    expect(advise(s, "me").upgrade[0].actions?.[0]).toMatchObject({ type: "unmortgage", spaceIndex: 3 });
  });
});

describe("advisor — dangers, jail and next step", () => {
  it("warns about big rents within one roll, with the right odds", () => {
    const s = game();
    s.players[0].position = 32;
    s.ownership[39] = own("bob", 5); // New York hotel, 7 away
    const w = advise(s, "me").watch;
    expect(w[0].title).toBe("Bob's hotel on New York");
    expect(w[0].detail).toMatch(/roll 7 \(1 in 6\)/);
    expect(rollOdds(7)).toBeCloseTo(1 / 6);
    expect(rollOdds(2)).toBeCloseTo(1 / 36);
  });

  it("flags rents you can't cover", () => {
    const s = game();
    s.players[0].position = 32;
    s.players[0].money = 300;
    s.ownership[39] = own("bob", 5);
    expect(advise(s, "me").watch[0].tag?.label).toBe("CAN'T COVER");
  });

  it("jail: pay early, stay late, use a card first", () => {
    const s = game();
    s.players[0].inJail = true;
    expect(advise(s, "me").now[0].actions?.[0].type).toBe("payJailFine");
    for (const i of [16, 18, 19]) s.ownership[i] = own("bob", 2);
    expect(advise(s, "me").now[0].title).toMatch(/Stay in jail/);
    s.players[0].jailCards = 1;
    expect(advise(s, "me").now[0].actions?.[0].type).toBe("useJailCard");
  });

  it("gives the next step and stays quiet off-turn", () => {
    const s = game();
    expect(advise(s, "me").now[0].actions?.[0].type).toBe("roll");
    expect(advise(s, "me").urgent).toBe(true);
    s.turn.phase = "awaitingAction";
    expect(advise(s, "me").now[0].actions?.[0].type).toBe("endTurn");
    expect(advise(s, "bob").now[0].title).toBe("Waiting for Sasha");
    expect(advise(s, "bob").urgent).toBe(false);
  });

  it("returns nothing for spectators and finished games, and never mutates state", () => {
    const s = game();
    const before = JSON.stringify(s);
    advise(s, "me");
    expect(JSON.stringify(s)).toBe(before);
    expect(advise(s, null).now).toHaveLength(0);
    s.phase = "finished";
    expect(advise(s, "me").now).toHaveLength(0);
  });
});
