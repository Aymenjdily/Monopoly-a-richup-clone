import { describe, expect, it } from "vitest";

import { soundForEvent, soundsForBatch } from "./events";

const e = (text: string, kind: "info" | "money" | "jail" | "roll" | "turn" = "info", actor?: string) => ({ kind, text, actor });

describe("event → sound", () => {
  it("maps money and property events", () => {
    expect(soundForEvent(e("Sasha buys Istanbul for $240", "money"), "Sasha")).toBe("buy");
    expect(soundForEvent(e("Juno builds on Osaka for $50", "money"), "Sasha")).toBe("build");
    expect(soundForEvent(e("Sasha mortgages Miami for $175", "money"), "Sasha")).toBe("mortgage");
    expect(soundForEvent(e("Juno passes GO and collects $200", "money"), "Sasha")).toBe("go");
    expect(soundForEvent(e("Lina pays $200 Income Tax", "money"), "Sasha")).toBe("tax");
  });

  it("signs rent from the viewer's side", () => {
    const rent = e("Marek pays $180 rent to Sasha for Madrid", "money", "Marek");
    expect(soundForEvent(rent, "Sasha")).toBe("rentGet");
    expect(soundForEvent(rent, "Marek")).toBe("rentPay");
    expect(soundForEvent(rent, "Juno")).toBe("coin");
    expect(soundForEvent(rent, null)).toBe("coin");
  });

  it("maps cards, jail, win and bankruptcy", () => {
    expect(soundForEvent(e('Juno draws Chance: "Advance to GO."'), null)).toBe("card");
    expect(soundForEvent(e("Dice Bot was sent to Jail. Landed on Go To Jail", "jail"), null)).toBe("jail");
    expect(soundForEvent(e("Sasha pays the fine and is free to roll.", "jail"), null)).toBe("coin");
    expect(soundForEvent(e("👑 Sasha wins the game!"), null)).toBe("win");
    expect(soundForEvent(e("Juno is BANKRUPT. Assets return to the bank."), null)).toBe("bankrupt");
  });

  it("stays silent for rolls, turns, collect echoes and lobby noise", () => {
    expect(soundForEvent(e("Sasha rolled 3+4", "roll"), null)).toBeNull();
    expect(soundForEvent(e("— Juno's turn —", "turn"), null)).toBeNull();
    expect(soundForEvent(e("Sasha collects.", "money"), null)).toBeNull();
    expect(soundForEvent(e("Sasha may buy Istanbul for $240."), null)).toBeNull();
    expect(soundForEvent(e("Dice Bot joined the room (bot)."), null)).toBeNull();
  });

  it("dedupes repeats and caps a burst", () => {
    const batch = [
      e("A passes GO and collects $200", "money"),
      e("A passes GO and collects $200", "money"),
      e("A buys X for $100", "money"),
      e("B buys Y for $100", "money"),
      e('A draws Chance: "x"'),
      e("A pays $200 Income Tax", "money"),
      e("A was sent to Jail.", "jail"),
    ];
    expect(soundsForBatch(batch, "A")).toEqual(["go", "buy", "card", "tax"]);
  });
});
