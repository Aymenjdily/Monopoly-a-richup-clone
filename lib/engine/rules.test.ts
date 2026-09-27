import { describe, expect, it } from "vitest";

import { applyAction } from "./engine";
import { checkWinner } from "./engine";
import { fixedRng } from "./rng";
import { rentDue, canBuild } from "./ownershipRules";
import {
  createState,
  JAIL_TILE,
  type GameState,
  type OwnershipEntry,
} from "./types";

const deed = (ownerId: string, houses = 0, mortgaged = false): OwnershipEntry => ({
  ownerId,
  houses,
  mortgaged,
});

const SAFE_DECKS = {
  chance: [9, 6, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0],
  chest: [19, 20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21],
};

function makeGame(): GameState {
  const state = createState([
    { id: "p1", name: "Alice", colorToken: "#ff0000" },
    { id: "p2", name: "Bob", colorToken: "#00ff00" },
  ]);
  state.decks = { chance: [...SAFE_DECKS.chance], chest: [...SAFE_DECKS.chest] };
  return state;
}

function playerOf(state: GameState, id: string) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error("missing player");
  return p;
}

function act(state: GameState, playerId: string, action: object, rngValues: number[] = [3, 4]) {
  return applyAction({ state, playerId, action: action as never, rng: fixedRng(rngValues) });
}

/** Places the roller so that dice totals walk them onto exactly `idx`. */

describe("buildings", () => {
  function awaitingSet(state: GameState): void {
    state.turn.playerIdx = 0;
    state.turn.phase = "awaitingAction";
    state.turn.doublesCount = 0;
    state.pending = undefined;
    for (const i of [16, 18, 19]) {
      state.ownership[i] = deed("p1"); // full orange set, houseCost 100
    }
  }

  it("charges house costs and enforces the even-build rule", () => {
    let state = makeGame();
    awaitingSet(state);
    const before = playerOf(state, "p1").money;
    let r = act(state, "p1", { type: "build", spaceIndex: 16 });
    state = r.state;
    expect(state.ownership[16].houses).toBe(1);
    expect(playerOf(state, "p1").money).toBe(before - 100);
    expect(r.ok).toBe(true);

    r = act(state, "p1", { type: "build", spaceIndex: 16 }); // uneven: rejected
    expect(r.ok).toBe(false);

    r = act(state, "p1", { type: "build", spaceIndex: 18 }); // catches up: ok
    state = r.state;
    expect(state.ownership[18].houses).toBe(1);
  });

  it("builds through the ladder to a hotel and sells back at half price", () => {
    let state = makeGame();
    awaitingSet(state);
    for (const i of [16, 18, 19]) state.ownership[i].houses = 4;
    let r = act(state, "p1", { type: "build", spaceIndex: 16 });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.ownership[16].houses).toBe(5); // hotel level

    const before = playerOf(state, "p1").money;
    r = act(state, "p1", { type: "sellBuilding", spaceIndex: 16 });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.ownership[16].houses).toBe(4);
    expect(playerOf(state, "p1").money).toBe(before + 50);
  });

  it("cannot build with an incomplete set, or where set is mortgaged", () => {
    const state = makeGame();
    state.turn.playerIdx = 0;
    state.turn.phase = "awaitingAction";
    state.ownership[16] = deed("p1");
    const r = act(state, "p1", { type: "build", spaceIndex: 16 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("full color set");

    const s2 = makeGame();
    awaitingSet(s2);
    s2.ownership[18].mortgaged = true;
    const r2 = act(s2, "p1", { type: "build", spaceIndex: 16 });
    expect(r2.ok).toBe(false);
  });

  it("canBuild helper rejects a mortgaged tile inside an owned set", () => {
    const state = makeGame();
    awaitingSet(state);
    state.ownership[18].mortgaged = true;
    expect(canBuild(state, "p1", 16).ok).toBe(false);
  });
});

describe("mortgage", () => {
  it("mortgage grants half price; unmortgage costs +10% interest", () => {
    let state = makeGame();
    state.turn.playerIdx = 0;
    state.turn.phase = "awaitingAction";
    state.decks = SAFE_DECKS;
    state.ownership[6] = deed("p1"); // Oriental $100 → mv 50
    let r = act(state, "p1", { type: "mortgage", spaceIndex: 6 });
    state = r.state;
    expect(state.ownership[6].mortgaged).toBe(true);
    expect(playerOf(state, "p1").money).toBe(1500 + 50);

    r = act(state, "p1", { type: "unmortgage", spaceIndex: 6 });
    state = r.state;
    expect(state.ownership[6].mortgaged).toBe(false);
    expect(playerOf(state, "p1").money).toBe(1550 - 55); // 50 + ceil(50 × 0.1)
  });

  it("mortgage blocked with houses on the tile; rent is zero while mortgaged", () => {
    const state = makeGame();
    state.turn.playerIdx = 0;
    state.turn.phase = "awaitingAction";
    state.decks = SAFE_DECKS;
    state.ownership[1] = deed("p1", 1);
    const r = act(state, "p1", { type: "mortgage", spaceIndex: 1 });
    expect(r.ok).toBe(false);

    const s2 = makeGame();
    s2.ownership[1] = deed("p2", 0, true);
    const rent = rentDue(s2, 1, 0);
    expect(rent.kind === "rent" ? rent.kind : rent.reason).toBe("mortgaged");
  });
});

describe("jail options", () => {
  function jailP1(state: GameState): void {
    const p = playerOf(state, "p1");
    p.position = JAIL_TILE;
    p.inJail = true;
    p.jailTurns = 0;
  }

  it("payJailFine frees the player, then a normal roll moves", () => {
    let state = makeGame();
    jailP1(state);
    state = act(state, "p1", { type: "payJailFine" }).state;
    const p = playerOf(state, "p1");
    expect(p.inJail).toBe(false);
    expect(p.money).toBe(1450);
    state = act(state, "p1", { type: "roll" }, [1, 4]).state;
    expect(playerOf(state, "p1").position).toBe(15);
    expect(state.pending?.type).toBe("buy"); // Reading RR unowned
  });

  it("useJailCard consumes the held card and returns it to its deck", () => {
    let state = makeGame();
    // simulate holding the chest Get Out of Jail card (id 20): deck lacks it
    state.decks = { chance: [6, 9, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 0], chest: [19, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 21] };
    jailP1(state);
    playerOf(state, "p1").jailCards = 1;
    state = act(state, "p1", { type: "useJailCard" }).state;
    const p = playerOf(state, "p1");
    expect(p.inJail).toBe(false);
    expect(p.jailCards).toBe(0);
    expect(state.decks.chest.includes(20)).toBe(true); // returned to bottom
    expect(state.decks.chance.includes(6)).toBe(true); // chance card untouched
  });
});

describe("cards", () => {
  it("Chance 'Advance to GO' collects a single salary on arrival", () => {
    const state = makeGame();
    state.decks.chance = [0, 15, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 6, 9];
    state.players[0].position = 5;
    const before = playerOf(state, "p1").money;
    const r = act(state, "p1", { type: "roll" }, [1, 1]); // doubles 2: 5 → 7 chance → card 0
    expect(r.ok).toBe(true);
    const p = playerOf(r.state, "p1");
    expect(p.position).toBe(0);
    expect(p.money).toBe(before + 200);
    // Doubles streak: re-roll remains (pending none — GO is not a tile effect).
    expect(r.state.turn.phase).toBe("preRoll");
  });

  it("Chest 'Go directly to Jail' ends the turn right away", () => {
    const state = makeGame();
    state.decks.chest = [21, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 20, 19];
    state.players[0].position = 14; // 14 + 3 = 17 (real chest tile)
    const r = act(state, "p1", { type: "roll" }, [1, 2]); // 17 chest → draw 21
    expect(r.ok).toBe(true);
    const p = playerOf(r.state, "p1");
    expect(p.inJail).toBe(true);
    expect(p.position).toBe(JAIL_TILE);
    expect(r.state.turn.playerIdx).toBe(1);
  });

  it("chest jail card stays out of the deck while held", () => {
    const state = makeGame();
    state.decks.chest = [20, 17, 25, 23, 16, 28, 31, 30, 18, 27, 26, 24, 29, 22, 19, 21];
    state.players[0].position = 14; // 14 + 3 = 17 chest
    const r = act(state, "p1", { type: "roll" }, [1, 2]);
    expect(playerOf(r.state, "p1").jailCards).toBe(1);
    expect(r.state.decks.chest.includes(20)).toBe(false);
  });

  it("Chance 'advance to nearest railroad' charges double rent", () => {
    const state = makeGame();
    state.ownership[15] = deed("p2"); // one railroad, base rent 25
    state.decks.chance = [3, 15, 14, 7, 5, 9, 13, 4, 2, 12, 10, 11, 8, 1, 6, 0];
    const before = playerOf(state, "p1").money;
    state.players[0].position = 2;
    const r = act(state, "p1", { type: "roll" }, [3, 2]); // total 5 → 7 Chance → nearest RR 15
    expect(playerOf(r.state, "p1").position).toBe(15);
    expect(playerOf(r.state, "p1").money).toBe(before - 50); // 25 × 2
  });

  it("Chance 'advance to nearest utility' charges 10× dice", () => {
    const state = makeGame();
    state.ownership[12] = deed("p2");
    state.decks.chance = [5, 15, 14, 7, 3, 9, 13, 4, 2, 12, 10, 11, 8, 1, 6, 0];
    const before = playerOf(state, "p1").money;
    state.players[0].position = 0;
    const r = act(state, "p1", { type: "roll" }, [3, 4]); // 7 Chance → nearest utility 12
    expect(playerOf(r.state, "p1").position).toBe(12);
    expect(playerOf(r.state, "p1").money).toBe(before - 70); // 10 × 7
  });

  it("'collect from each player' moves money between players", () => {
    const state = makeGame();
    state.decks.chance = [15, 6, 14, 7, 5, 3, 13, 4, 2, 12, 10, 11, 8, 1, 9, 0];
    const before = playerOf(state, "p1").money;
    state.players[0].position = 2;
    const r = act(state, "p1", { type: "roll" }, [3, 2]); // total 5 → 7 Chance → collect 50 from each
    expect(playerOf(r.state, "p1").money).toBe(before + 50);
    expect(playerOf(r.state, "p2").money).toBe(1450);
  });
});

describe("rent formulas via engine", () => {
  it("full clean set doubles bare rent", () => {
    const state = makeGame();
    state.ownership[1] = deed("p2");
    state.ownership[3] = deed("p2");
    state.players[0].position = 39;
    const r = act(state, "p1", { type: "roll" }, [1, 1]); // pass GO (+200) → Medaway rent 2×2
    expect(playerOf(r.state, "p1").money).toBe(1500 + 200 - 4);
    expect(playerOf(r.state, "p2").money).toBe(1500 + 4);
  });

  it("railroad ladder: 2 owned railroads charge double the base", () => {
    const state = makeGame();
    state.ownership[5] = deed("p2");
    state.ownership[15] = deed("p2");
    state.players[0].position = 0;
    const r = act(state, "p1", { type: "roll" }, [2, 3]); // 5 Reading RR
    expect(playerOf(r.state, "p1").money).toBe(1500 - 50);
    expect(playerOf(r.state, "p2").money).toBe(1550);
  });

  it("utility 10× when both utilities owned", () => {
    const state = makeGame();
    state.ownership[12] = deed("p2");
    state.ownership[28] = deed("p2");
    state.players[0].position = 0;
    const r = act(state, "p1", { type: "roll" }, [6, 6]); // doubles lands 12, utility rent 10×12
    expect(playerOf(r.state, "p1").money).toBe(1500 - 120);
  });
});

describe("bankruptcy and win", () => {
  it("shortfall liquidates properties before bankruptcy is declared", () => {
    const state = makeGame();
    state.ownership[39] = deed("p2"); // Boardwalk base rent 50
    state.ownership[6] = deed("p1"); // Oriental mortgageValue 50
    state.players[0].money = 20;
    state.players[0].position = 37;
    const r = act(state, "p1", { type: "roll" }, [1, 1]); // ♥ rent 50: pay 20, liquidate Oriental (+50), pay 30
    expect(playerOf(r.state, "p1").bankrupt).toBe(false);
    expect(playerOf(r.state, "p1").money).toBe(20); // 0 + 50 - 30
    expect(playerOf(r.state, "p2").money).toBe(1500 + 50);
    expect(r.state.ownership[6].mortgaged).toBe(true);
  });

  it("liquidation ceiling reached → bankruptcy; deeds transfer to the creditor", () => {
    const state = makeGame();
    state.ownership[37] = deed("p2"); // Park Place rent 35
    state.ownership[1] = deed("p1"); // Med mortgageValue 30 (< debt 34)
    state.players[0].money = 1;
    state.players[0].position = 35;
    const r = act(state, "p1", { type: "roll" }, [1, 1]); // 2 steps → 37 Park, rent 35
    const p1 = playerOf(r.state, "p1");
    expect(p1.bankrupt).toBe(true);
    expect(p1.money).toBe(0);
    expect(r.state.ownership[1]?.ownerId).toBe("p2"); // deed transferred
    expect(r.state.ownership[1]?.mortgaged).toBe(true); // inherited mortgage
    expect(r.state.phase).toBe("finished");
    expect(r.state.winner).toBe("p2");
  });

  it("bank debts return properties to the market on bankruptcy", () => {
    const state = makeGame();
    state.ownership[1] = deed("p1"); // Med (mv 30)
    state.ownership[3] = deed("p1"); // Baltic (mv 30)
    state.players[0].money = 0;
    state.players[0].position = 36;
    const r = act(state, "p1", { type: "roll" }, [1, 1]); // 38 luxury tax $100
    expect(playerOf(r.state, "p1").bankrupt).toBe(true);
    expect(r.state.ownership[1]).toBeUndefined(); // back to market
    expect(r.state.ownership[3]).toBeUndefined();
    expect(r.state.phase).toBe("finished");
  });

  it("winner blocks all further actions", () => {
    const state = makeGame();
    state.ownership[6] = deed("p2");
    state.players[0].position = 3;
    state.players[0].money = 3;
    const r = act(state, "p1", { type: "roll" }, [1, 2]); // total 3: 3 → 6 Oriental rent 6, cash 3 → bankrupt
    expect(r.state.phase).toBe("finished");
    const after = structuredClone(r.state);
    const r2 = act(r.state, "p2", { type: "roll" });
    expect(r2.ok).toBe(false);
    expect(r2.state).toEqual(after);
  });

  it("checkWinner declares the last solvent player", () => {
    const state = makeGame();
    state.players[1].bankrupt = true;
    state.players[1].money = 0;
    checkWinner(state);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("p1");
  });
});

describe("rejection safety", () => {
  it("rolling with a pending buy is rejected without mutation", () => {
    let state = makeGame();
    state = act(state, "p1", { type: "roll" }, [2, 4]).state; // lands 6 unowned → pending
    const after = structuredClone(state);
    const r = act(state, "p1", { type: "roll" });
    expect(r.ok).toBe(false);
    expect(r.state).toEqual(after);
  });

  it("endTurn with a pending buy is rejected", () => {
    let state = makeGame();
    state = act(state, "p1", { type: "roll" }, [2, 4]).state;
    const r = act(state, "p1", { type: "endTurn" });
    expect(r.ok).toBe(false);
  });

  it("out-of-turn actions are rejected without mutation (mortgage case)", () => {
    const state = makeGame();
    state.turn.playerIdx = 0;
    state.turn.phase = "awaitingAction";
    state.ownership[6] = deed("p2");
    const after = structuredClone(state);
    const r = act(state, "p1", { type: "mortgage", spaceIndex: 6 });
    expect(r.ok).toBe(false);
    expect(r.state).toEqual(after);
  });
});
