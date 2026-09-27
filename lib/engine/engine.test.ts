import { describe, expect, it } from "vitest";

import { BOARD } from "./board";
import { applyAction } from "./engine";
import { fixedRng, mulberry32, rollDice } from "./rng";
import {
  GO_SALARY,
  JAIL_FINE,
  JAIL_TILE,
  START_MONEY,
  createState,
  type GameState,
  type Player,
} from "./types";

function makeGame(): GameState {
  return createState([
    { id: "p1", name: "Alice", colorToken: "#ff0000" },
    { id: "p2", name: "Bob", colorToken: "#00ff00" },
    { id: "p3", name: "Cara", colorToken: "#0000ff" },
  ]);
}

function playerOf(state: GameState, id: string): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`missing player ${id}`);
  return p;
}

function act(
  state: GameState,
  playerId: string,
  action: { type: string } & Record<string, unknown>,
  rngValues: number[] = [3, 4]
) {
  return applyAction({ state, playerId, action: action as never, rng: fixedRng(rngValues) });
}

describe("board config", () => {
  it("has exactly 40 spaces with ordered indices", () => {
    expect(BOARD).toHaveLength(40);
    BOARD.forEach((space, i) => expect(space.index).toBe(i));
  });

  it("places classic tiles at canonical indices", () => {
    expect(BOARD[0].type).toBe("go");
    expect(BOARD[JAIL_TILE].type).toBe("jail");
    expect(BOARD[20].type).toBe("parking");
    expect(BOARD[30].type).toBe("gotojail");
    expect(BOARD[4].name).toBe("Income Tax");
    expect(BOARD[38].name).toBe("Luxury Tax");
    expect(BOARD[1].group).toBe("brown");
    expect(BOARD[39].group).toBe("darkblue");
  });

  it("gives every property a complete rent ladder, house cost, mortgage value", () => {
    for (const space of BOARD) {
      if (space.type === "property") {
        expect(space.price).toBeGreaterThan(0);
        expect(space.rentLadder).toHaveLength(6);
        expect(space.rentLadder![5]).toBeGreaterThan(space.rentLadder![0]);
        expect(space.houseCost!).toBeGreaterThan(0);
        expect(space.mortgageValue).toBe(Math.round(space.price! / 2));
      }
    }
  });
});

describe("rng", () => {
  it("produces dice in [1,6] with consistent totals/doubles", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const r = rollDice(rng);
      expect(r.die1).toBeGreaterThanOrEqual(1);
      expect(r.die1).toBeLessThanOrEqual(6);
      expect(r.die2).toBeGreaterThanOrEqual(1);
      expect(r.die2).toBeLessThanOrEqual(6);
      expect(r.total).toBe(r.die1 + r.die2);
      expect(r.isDoubles).toBe(r.die1 === r.die2);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = [...Array(20)].map(() => mulberry32(7).int(1, 6));
    const b = [...Array(20)].map(() => mulberry32(7).int(1, 6));
    expect(a).toEqual(b);
  });
});

describe("turn flow and rejection", () => {
  it("rejects an out-of-turn roll without mutating state", () => {
    const state = makeGame();
    const before = structuredClone(state);
    const result = applyAction({
      state,
      playerId: "p2",
      action: { type: "roll" },
      rng: fixedRng([2, 3]),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not p2's turn");
    expect(result.state).toEqual(before);
  });

  it("rejects an unknown action type", () => {
    const state = makeGame();
    const result = applyAction({
      state,
      playerId: "p1",
      action: { type: "trade" } as never,
      rng: fixedRng([1, 1]),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown action");
  });

  it("rejects roll during awaitingAction phase", () => {
    const state = makeGame();
    state.turn.phase = "awaitingAction";
    const result = act(state, "p1", { type: "roll" });
    expect(result.ok).toBe(false);
  });

  it("a non-doubles roll moves, resolves tile, and waits for endTurn", () => {
    const state0 = makeGame();
    // Deterministic decks: first chance card is harmless "[+$50] bank dividend" (id 9).
    state0.decks = { chance: [9, 6, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0], chest: [19, 20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21] };
    const { state } = act(state0, "p1", { type: "roll" }, [3, 4]); // 0 -> 7 chance, draws id 9
    const p = playerOf(state, "p1");
    expect(p.position).toBe(7);
    expect(state.turn.phase).toBe("awaitingAction");
    expect(state.dice).toEqual([3, 4]);
    expect(state.version).toBe(state0.version + 1);
    expect(p.money).toBe(START_MONEY + 50);
  });

  it("endTurn passes to the next player after an optional manage step", () => {
    let state = makeGame();
    state = act(state, "p1", { type: "roll" }, [2, 4]).state; // 6 Oriental unowned → pending buy
    expect(state.pending?.type).toBe("buy");
    state = act(state, "p1", { type: "buy" }).state;
    expect(state.pending).toBeUndefined();
    state = act(state, "p1", { type: "endTurn" }).state;
    expect(state.turn.playerIdx).toBe(1);
    expect(state.turn.phase).toBe("preRoll");
  });

  it("endTurn is rejected in preRoll phase", () => {
    const state = makeGame();
    const result = act(state, "p1", { type: "endTurn" });
    expect(result.ok).toBe(false);
  });

  it("doubles grant an immediate re-roll on the same player", () => {
    let state = makeGame();
    state.decks = { chance: [9, 6, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0], chest: [19, 20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21] };
    state = act(state, "p1", { type: "roll" }, [5, 5]).state; // 10 Just Visiting
    expect(state.turn.playerIdx).toBe(0);
    expect(state.turn.phase).toBe("preRoll");
    expect(playerOf(state, "p1").position).toBe(10);
    state = act(state, "p1", { type: "roll" }, [4, 4]).state; // 18 Tennessee, unowned → pending buy
    expect(playerOf(state, "p1").position).toBe(18);
    expect(state.pending?.type).toBe("buy");
    expect(state.turn.phase).toBe("awaitingAction");
    state = act(state, "p1", { type: "buy" }).state; // doubles streak intact → re-roll
    expect(state.turn.phase).toBe("preRoll");
    state = act(state, "p1", { type: "roll" }, [1, 2]).state; // non-doubles ends into buy pending
    expect(state.turn.phase).toBe("awaitingAction");
  });

  it("three doubles in a row send the player to jail without moving", () => {
    let state = makeGame();
    state.decks = { chance: [9, 6, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0], chest: [19, 20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21] };
    state = act(state, "p1", { type: "roll" }, [6, 6]).state; // 12 Electric, unowned → pending buy
    expect(state.pending?.type).toBe("buy");
    state = act(state, "p1", { type: "buy" }).state; // doubles streak continues
    expect(state.turn.phase).toBe("preRoll");
    state = act(state, "p1", { type: "roll" }, [4, 4]).state; // 20 Free Parking, doubles = 2
    expect(state.turn.doublesCount).toBe(2);
    state = act(state, "p1", { type: "roll" }, [3, 3]).state; // third doubles → jail
    const p = playerOf(state, "p1");
    expect(p.inJail).toBe(true);
    expect(p.position).toBe(JAIL_TILE);
    expect(state.turn.playerIdx).toBe(1);
  });
});

describe("movement and GO", () => {
  it("pays Go salary exactly once per pass", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 38;
    const startMoney = playerOf(state0, "p1").money;
    const { state } = act(state0, "p1", { type: "roll" }, [4, 4]); // 38 -> pass GO -> 6
    expect(playerOf(state, "p1").position).toBe(6);
    expect(playerOf(state, "p1").money).toBe(startMoney + GO_SALARY);
    expect(
      state.log.some(
        (e) => e.amount === GO_SALARY && e.text.includes("passes GO")
      )
    ).toBe(true);
  });

  it("crossing into a new lap passes GO once and resolves the landing tile", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 36;
    const startMoney = playerOf(state0, "p1").money;
    const { state } = act(state0, "p1", { type: "roll" }, [5, 3]); // 8: 36 -> 4
    expect(playerOf(state, "p1").position).toBe(4);
    expect(playerOf(state, "p1").money).toBe(startMoney + GO_SALARY - 200);
  });

  it("landing exactly on GO by roll sum also pays salary", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 33; // roll of 7 lands exactly on 0
    const startMoney = playerOf(state0, "p1").money;
    const { state } = act(state0, "p1", { type: "roll" }, [3, 4]); // 7: 33 -> 0 exactly
    const p = playerOf(state, "p1");
    expect(p.position).toBe(0);
    expect(p.money).toBe(startMoney + GO_SALARY);
  });
});

describe("taxes", () => {
  it("charges fixed income tax on landing", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 0;
    const before = playerOf(state0, "p1").money;
    const { state } = act(state0, "p1", { type: "roll" }, [2, 2]); // doubles 4: 0 -> 4 income tax $200
    expect(playerOf(state, "p1").position).toBe(4);
    expect(playerOf(state, "p1").money).toBe(before - 200);
    expect(state.turn.phase).toBe("preRoll"); // doubles re-roll still granted
  });

  it("charges luxury tax and clamps at zero without going negative", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 36;
    playerOf(state0, "p1").money = 50;
    const { state } = act(state0, "p1", { type: "roll" }, [1, 1]); // doubles 2: 36 -> 38 luxury tax $100
    expect(playerOf(state, "p1").position).toBe(38);
    expect(playerOf(state, "p1").money).toBe(0);
  });
});

describe("jail", () => {
  it("Go To Jail resets doublesCount and ends the turn", () => {
    const state0 = makeGame();
    playerOf(state0, "p1").position = 28;
    const { state } = act(state0, "p1", { type: "roll" }, [1, 1]);
    const p = playerOf(state, "p1");
    expect(p.position).toBe(JAIL_TILE);
    expect(p.inJail).toBe(true);
    expect(p.jailTurns).toBe(0);
    expect(state.turn.playerIdx).toBe(1);
    expect(state.turn.doublesCount).toBe(0);
  });

  it("failed jail rolls pass the turn; fine on 3rd failure; doubles leave jail", () => {
    // Attempt 1 (no doubles): turn passes.
    let state = makeGame();
    const jailBird = playerOf(state, "p1");
    jailBird.position = JAIL_TILE;
    jailBird.inJail = true;
    jailBird.jailTurns = 0;
    state = act(state, "p1", { type: "roll" }, [1, 2]).state;
    expect(playerOf(state, "p1").jailTurns).toBe(1);
    expect(state.turn.playerIdx).toBe(1);

    // Simulate the skip back to p1 (jail attempts happen on the player's own turns):
    state.turn.playerIdx = 0;
    state.turn.phase = "preRoll";
    playerOf(state, "p1").jailTurns = 2;
    const before = playerOf(state, "p1").money;
    state = act(state, "p1", { type: "roll" }, [2, 3]).state; // attempt 3 fails → fine + move
    const p = playerOf(state, "p1");
    expect(p.inJail).toBe(false);
    expect(p.jailTurns).toBe(0);
    expect(p.money).toBe(before - JAIL_FINE);
    expect(p.position).toBe(JAIL_TILE + 5);
    expect(state.turn.phase).toBe("awaitingAction");
  });

  it("leaving jail with doubles does not grant an extra re-roll", () => {
    const state0 = makeGame();
    const jailBird = playerOf(state0, "p1");
    jailBird.position = JAIL_TILE;
    jailBird.inJail = true;
    jailBird.jailTurns = 0;
    const before = jailBird.money;
    const { state } = act(state0, "p1", { type: "roll" }, [2, 2]);
    const p = playerOf(state, "p1");
    expect(p.inJail).toBe(false);
    expect(p.position).toBe(14);
    expect(state.turn.phase).toBe("awaitingAction");
    expect(p.money).toBe(before); // no fine paid when doubles succeed
  });
});

describe("determinism", () => {
  it("same inputs produce identical states", () => {
    const build = (): GameState => {
      let s = makeGame();
      s = act(s, "p1", { type: "roll" }, [4, 4]).state;
      s = act(s, "p1", { type: "roll" }, [2, 3]).state;
      s = act(s, "p1", { type: "endTurn" }).state;
      s = act(s, "p2", { type: "roll" }, [6, 1]).state;
      s = act(s, "p2", { type: "endTurn" }).state;
      return s;
    };
    expect(build()).toEqual(build());
  });
});

describe("sanity", () => {
  it("players start with START_MONEY", () => {
    expect(makeGame().players.every((p) => p.money === START_MONEY)).toBe(true);
  });
});
