import { describe, expect, it } from "vitest";

import { applyAction } from "./engine";
import { PLAYER_COLORS, addBot, joinLobby, leaveLobby, lobbyState, setPresence, startGame } from "./lobby";
import { fixedRng, mulberry32 } from "./rng";
import type { GameState } from "./types";

function lobby(): GameState {
  const s = lobbyState({ id: "h", name: "Host" });
  joinLobby(s, { id: "a", name: "Ana" });
  addBot(s, "bot1");
  joinLobby(s, { id: "b", name: "Ben" });
  return s; // seats: Host, Ana, bot, Ben
}
const host = (s: GameState) => s.players.find((p) => p.isHost)?.id;

describe("presence and host handover", () => {
  it("passes the host to the next connected human (never a bot) when the host goes away", () => {
    const s = lobby();
    const v = s.version;
    expect(setPresence(s, "h", false)).toBe(true);
    expect(host(s)).toBe("a");
    expect(s.players[0].connected).toBe(false);
    expect(s.version).toBe(v + 1);
  });

  it("skips humans who are away and doesn't take the host back on return", () => {
    const s = lobby();
    setPresence(s, "a", false); // Ana away
    setPresence(s, "h", false); // host away → Ana skipped, bot skipped → Ben
    expect(host(s)).toBe("b");
    setPresence(s, "h", true);
    expect(host(s)).toBe("b");
    expect(s.players[0].connected).toBe(true);
  });

  it("is a no-op for bots and unchanged presence", () => {
    const s = lobby();
    const v = s.version;
    expect(setPresence(s, "bot1", false)).toBe(false);
    expect(setPresence(s, "a", true)).toBe(false);
    expect(s.version).toBe(v);
  });
});

describe("leaving", () => {
  it("lobby leave frees the seat, hands off the host to a human, and new joiners get an unused color", () => {
    const s = lobby();
    const anaColor = s.players[1].colorToken;
    leaveLobby(s, "h");
    expect(s.players.map((p) => p.id)).toEqual(["a", "bot1", "b"]);
    expect(host(s)).toBe("a");
    leaveLobby(s, "a"); // next human after Ana is Ben, not the bot
    expect(host(s)).toBe("b");
    joinLobby(s, { id: "c", name: "Cy" });
    const colors = s.players.map((p) => p.colorToken);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).toContain(PLAYER_COLORS[0]); // the host's freed red is reused first
    expect(anaColor).toBe(PLAYER_COLORS[1]);
  });

  it("in-game leave is a forfeit: bankrupt to the bank, cities back to market, turn moves on", () => {
    const s = lobby();
    startGame(s, mulberry32(1));
    s.ownership[1] = { ownerId: "h", houses: 0, mortgaged: false };
    const r = applyAction({ state: s, playerId: "h", action: { type: "leaveRoom" }, rng: fixedRng([1, 2]) });
    expect(r.ok).toBe(true);
    const h = r.state.players.find((p) => p.id === "h")!;
    expect(h.bankrupt).toBe(true);
    expect(h.connected).toBe(false);
    expect(r.state.ownership[1]).toBeUndefined();
    expect(r.state.players[r.state.turn.playerIdx].id).toBe("a");
    expect(host(r.state)).toBe("a");
  });

  it("anyone can leave, even off-turn; the last one standing wins", () => {
    let s: GameState = lobbyState({ id: "h", name: "Host" });
    joinLobby(s, { id: "a", name: "Ana" });
    startGame(s, mulberry32(2));
    const r = applyAction({ state: s, playerId: "a", action: { type: "leaveRoom" }, rng: fixedRng([1, 2]) });
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe("h");
    expect(applyAction({ state: s, playerId: "a", action: { type: "leaveRoom" }, rng: fixedRng([1]) }).ok).toBe(false);
  });
});
