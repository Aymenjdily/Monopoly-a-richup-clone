import { describe, expect, it } from "vitest";

import { botChoose, BOT_BUY_RESERVE } from "./bots";
import { joinLobby, lobbyState, startGame } from "./lobby";
import { addBot, removePlayer } from "./lobby";
import { mulberry32 } from "./rng";

function bootState() {
  let s = lobbyState({ id: "h1", name: "Host" });
  s.players[0].isBot = true; // bot-hosted for uniform tests
  s = joinLobby(s, { id: "j2", name: "Juno" });
  s = startGame(s, mulberry32(11));
  s.pending = undefined;
  return s;
}

describe("botChoose policy", () => {
  it("rolls in preRoll", () => {
    const s = bootState();
    s.turn = { playerIdx: 0, phase: "preRoll", doublesCount: 0, rolled: false };
    expect(botChoose(s)).toEqual({ type: "roll" });
  });

  it("buys pending property when cash covers price + reserve, else declines", () => {
    const s = bootState();
    s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: false };
    s.pending = { type: "buy", spaceIndex: 39, price: 400 };
    s.players[0].money = 400 + BOT_BUY_RESERVE + 10;
    expect(botChoose(s)).toEqual({ type: "buy" });
    s.players[0].money = 400 + BOT_BUY_RESERVE - 1;
    expect(botChoose(s)).toEqual({ type: "decline" });
  });

  it("ends the turn when there is nothing pending", () => {
    const s = bootState();
    s.turn = { playerIdx: 0, phase: "awaitingAction", doublesCount: 0, rolled: false };
    s.pending = undefined;
    expect(botChoose(s)).toEqual({ type: "endTurn" });
  });

  it("prioritizes jail card over fine over rolling from jail", () => {
    const s = bootState();
    s.turn = { playerIdx: 0, phase: "preRoll", doublesCount: 0, rolled: false };
    const p = s.players[0];
    p.inJail = true;

    p.jailCards = 1;
    expect(botChoose(s)).toEqual({ type: "useJailCard" });

    p.jailCards = 0;
    p.money = 100;
    expect(botChoose(s)).toEqual({ type: "payJailFine" });

    p.money = 99;
    expect(botChoose(s)).toEqual({ type: "roll" });
  });

  it("returns null for human turns and bankrupt bots", () => {
    const s = bootState();
    s.players[0].isBot = false;
    expect(botChoose(s)).toBeNull();
    const s2 = bootState();
    s2.players[0].bankrupt = true;
    expect(botChoose(s2)).toBeNull();
  });
});

describe("lobby bot seats", () => {
  it("addBot fills deterministic seats; removePlayer kicks bots", () => {
    let s = lobbyState({ id: "h1", name: "Host" });
    s = addBot(s, "b1");
    s = addBot(s, "b2");
    expect(s.players).toHaveLength(3);
    expect(s.players[1].isBot).toBe(true);
    expect(s.players[1].name).toBe("Dice Bot");
    expect(s.players[2].name).toBe("Rent Bot");
    expect(s.players[1].money).toBe(1500);

    s = removePlayer(s, "b1");
    expect(s.players).toHaveLength(2);
    expect(s.players[0].name).toBe("Host");
    expect(s.players[1].name).toBe("Rent Bot");
    expect(s.players[1].isBot).toBe(true);

    expect(() => removePlayer(s, "ghost")).toThrow("not in room");
  });

  it("bots cannot be added after start and cap at 6", () => {
    let s = lobbyState({ id: "h", name: "H" });
    for (let i = 1; i < 6; i++) s = addBot(s, `b${i}`);
    expect(() => addBot(s, "b6")).toThrow("full");
    s = startGame(s, mulberry32(5));
    expect(() => addBot(s, "late")).toThrow("lobby");
  });
});
