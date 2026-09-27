import { describe, expect, it } from "vitest";

import { buildHistory, filterHistory, formatMoney } from "./history";

const LOG = [
  { id: 1, kind: "info" as const, text: "Sasha started the game. 2 players in." },
  { id: 2, kind: "turn" as const, actor: "Sasha", text: "— Sasha's turn —" },
  { id: 3, kind: "roll" as const, actor: "Sasha", text: "Sasha rolled 2+3" },
  { id: 4, kind: "money" as const, actor: "Sasha", amount: -200, text: "Sasha pays $200 Income Tax" },
  { id: 5, kind: "turn" as const, actor: "Juno", text: "— Juno's turn —" },
  { id: 6, kind: "roll" as const, actor: "Juno", text: "Juno rolled 4+4 (doubles)" },
  { id: 7, kind: "money" as const, actor: "Juno", amount: -18, text: "Juno pays $18 rent to Sasha for Antalya" },
  { id: 8, kind: "money" as const, actor: "Sasha", amount: 18, text: "Sasha collects." },
  { id: 9, kind: "money" as const, actor: "Juno", amount: 200, text: "Juno passes GO and collects $200" },
];

describe("history feed", () => {
  it("groups by turn, newest first, with setup at the end", () => {
    const g = buildHistory(LOG, "Sasha", false);
    expect(g.map((x) => [x.turn, x.actor])).toEqual([[2, "Juno"], [1, "Sasha"], [0, undefined]]);
    expect(g[0].items.map((i) => i.icon)).toEqual(["🎲", "💸", "➡️"]);
  });

  it("folds rent collection into the payment and signs it for the viewer", () => {
    const rent = (me: string | null) => buildHistory(LOG, me, false)[0].items[1];
    expect(rent("Sasha")).toMatchObject({ amount: 18, tone: "plus" });
    expect(rent("Juno")).toMatchObject({ amount: -18, tone: "minus" });
    expect(rent(null)).toMatchObject({ amount: 18, tone: "neutral" });
    expect(buildHistory(LOG, "Sasha", false)[0].items).toHaveLength(3); // "collects." dropped
  });

  it("marks bank fees as jackpot money when the jackpot rule is on", () => {
    const tax = (jackpot: boolean) => buildHistory(LOG, "Sasha", jackpot)[1].items[1];
    expect(tax(true)).toMatchObject({ amount: 200, tone: "pot", icon: "🧾" });
    expect(tax(false)).toMatchObject({ amount: -200, tone: "minus" });
  });

  it("filters money and moves", () => {
    const g = buildHistory(LOG, "Sasha", false);
    expect(filterHistory(g, "money").flatMap((x) => x.items.map((i) => i.key))).toEqual(["7", "9", "4"]);
    expect(filterHistory(g, "moves").flatMap((x) => x.items.map((i) => i.key))).toEqual(["6", "3"]);
  });

  it("never shows a money pill for dice rolls (the engine stores the total in amount)", () => {
    const g = buildHistory([{ id: 1, kind: "turn", actor: "A", text: "— A's turn —" }, { id: 2, kind: "roll", actor: "A", amount: 7, text: "A rolled 3+4" }], "A", false);
    expect(g[0].items[0].amount).toBeUndefined();
  });

  it("formats integer money", () => {
    expect(formatMoney(1240)).toBe("$1,240");
    expect(formatMoney(-50)).toBe("−$50");
  });
});
