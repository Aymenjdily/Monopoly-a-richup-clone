import { describe, expect, it } from "vitest";

import { BOT_RESERVE, botChooseRules, botOptions } from "@/lib/engine/bots";
import { DEFAULT_SETTINGS } from "@/lib/engine/settings";
import { createState, type GameState, type OwnershipEntry } from "@/lib/engine/types";

import { JEV_MIN_CONFIDENCE, JEV_URL, decideBotMove, describePosition } from "./botBrain";

const own = (ownerId: string, houses = 0, mortgaged = false): OwnershipEntry => ({ ownerId, houses, mortgaged });

function game(style: "cautious" | "balanced" | "aggressive" = "balanced"): GameState {
  const s = createState([
    { id: "bot", name: "Dice Bot", colorToken: "#f5a623" },
    { id: "human", name: "Sasha", colorToken: "#e5484d" },
  ]);
  s.settings = { ...DEFAULT_SETTINGS };
  s.players[0].isBot = true;
  s.players[0].botStyle = style;
  s.players[0].secret = "bot-secret";
  s.players[1].secret = "human-secret";
  s.decks = { chance: [1, 2, 3], chest: [4, 5, 6] };
  return s;
}
function pendingBuy(s: GameState, idx: number, price: number) {
  s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: true };
  s.pending = { type: "buy", spaceIndex: idx, price };
}
const fakeJev = (choice: string, confidence = 0.9, calls: unknown[] = []) =>
  async (url: string, init: { body: string; headers: Record<string, string> }) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ answers: { move: { type: "choice", choice, confidence } } }) };
  };

describe("bot options (engine)", () => {
  it("lists only legal moves per phase", () => {
    const s = game();
    expect(botOptions(s).map((o) => o.id)).toEqual(["roll"]);
    s.players[0].inJail = true;
    s.players[0].jailCards = 1;
    expect(botOptions(s).map((o) => o.id)).toEqual(["use_card", "pay_fine", "roll"]);
    pendingBuy(s, 24, 240);
    s.players[0].inJail = false;
    expect(botOptions(s).map((o) => o.id)).toEqual(["buy", "pass"]);
    s.players[0].money = 100;
    expect(botOptions(s).map((o) => o.id)).toEqual(["pass"]); // can't afford → no buy option
  });

  it("offers building and unmortgaging on full sets, and nothing on a human's turn", () => {
    const s = game();
    for (const i of [16, 18, 19]) s.ownership[i] = own("bot");
    s.ownership[1] = own("bot");
    s.ownership[3] = own("bot", 0, true);
    s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: true };
    const ids = botOptions(s).map((o) => o.id);
    expect(ids.filter((i) => i.startsWith("build_"))).toHaveLength(1); // one best target per buildable set
    expect(ids).toContain("unmortgage_3");
    expect(ids[ids.length - 1]).toBe("end_turn");
    s.turn.playerIdx = 1;
    expect(botOptions(s)).toEqual([]);
  });
});

describe("rule brain personalities", () => {
  it("buys according to each personality's reserve, and always completes a set", () => {
    for (const style of ["cautious", "balanced", "aggressive"] as const) {
      const s = game(style);
      pendingBuy(s, 24, 240);
      s.players[0].money = 240 + BOT_RESERVE[style];
      expect(botChooseRules(s)?.id).toBe("buy");
      s.players[0].money = 240 + BOT_RESERVE[style] - 1;
      expect(botChooseRules(s)?.id).toBe("pass");
    }
    const s = game("cautious");
    s.ownership[21] = own("bot");
    s.ownership[23] = own("bot");
    pendingBuy(s, 24, 240);
    s.players[0].money = 250; // far below the cautious reserve, but it completes the set
    expect(botChooseRules(s)?.id).toBe("buy");
  });

  it("builds when it keeps the reserve, otherwise ends the turn", () => {
    const s = game("balanced");
    for (const i of [16, 18, 19]) s.ownership[i] = own("bot");
    s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: true };
    s.players[0].money = 100 + BOT_RESERVE.balanced;
    expect(botChooseRules(s)?.id).toMatch(/^build_/);
    s.players[0].money = 100 + BOT_RESERVE.balanced - 1;
    expect(botChooseRules(s)?.id).toBe("end_turn");
  });
});

describe("Jev brain", () => {
  it("uses Jev's pick when it is a legal option with enough confidence", async () => {
    const s = game("cautious");
    pendingBuy(s, 24, 240);
    s.players[0].money = 2000; // rules would buy…
    const calls: { url: string; init: { body: string; headers: Record<string, string> } }[] = [];
    const d = await decideBotMove(s, { apiKey: "k", fetchImpl: fakeJev("pass", 0.8, calls) as never });
    expect(d).toMatchObject({ source: "jev", confidence: 0.8 });
    expect(d?.option.action).toEqual({ type: "decline" }); // …but the model said pass
    expect(calls[0].url).toBe(JEV_URL);
    expect(calls[0].init.headers.Authorization).toBe("Bearer k");
    const body = JSON.parse(calls[0].init.body);
    expect(Object.keys(body.questions.move.criteria)).toEqual(["buy", "pass"]);
  });

  it("never sends secrets or deck order", async () => {
    const s = game();
    pendingBuy(s, 24, 240);
    const calls: { init: { body: string } }[] = [];
    await decideBotMove(s, { apiKey: "k", fetchImpl: fakeJev("buy", 0.9, calls) as never });
    expect(calls[0].init.body).not.toMatch(/bot-secret|human-secret|"decks"|chance":\[/);
    expect(describePosition(s, s.players[0])).toContain("Balanced player");
  });

  it("skips the model when there is only one option", async () => {
    const s = game();
    const calls: unknown[] = [];
    const d = await decideBotMove(s, { apiKey: "k", fetchImpl: fakeJev("roll", 0.9, calls) as never });
    expect(d?.source).toBe("single");
    expect(calls).toHaveLength(0);
  });

  it("falls back to the rules on no key, bad answers, low confidence, HTTP errors and timeouts", async () => {
    const mk = () => {
      const s = game();
      pendingBuy(s, 24, 240);
      return s; // rules: buy (cash 1500)
    };
    expect(await decideBotMove(mk(), { apiKey: undefined })).toMatchObject({ source: "rules", fallback: "no-key", option: { id: "buy" } });
    expect(await decideBotMove(mk(), { apiKey: "k", fetchImpl: fakeJev("sell_everything") as never })).toMatchObject({ source: "rules", fallback: "invalid" });
    expect(await decideBotMove(mk(), { apiKey: "k", fetchImpl: fakeJev("pass", JEV_MIN_CONFIDENCE - 0.01) as never })).toMatchObject({ source: "rules", fallback: "low-confidence", option: { id: "buy" } });
    const http500 = async () => ({ ok: false, status: 529, json: async () => ({}) });
    expect(await decideBotMove(mk(), { apiKey: "k", fetchImpl: http500 as never })).toMatchObject({ source: "rules", fallback: "http" });
    const aborts = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
    expect(await decideBotMove(mk(), { apiKey: "k", fetchImpl: aborts as never })).toMatchObject({ source: "rules", fallback: "timeout" });
  });

  it("returns null on a human's turn", async () => {
    const s = game();
    s.turn.playerIdx = 1;
    expect(await decideBotMove(s, { apiKey: "k", fetchImpl: fakeJev("roll") as never })).toBeNull();
  });
});
