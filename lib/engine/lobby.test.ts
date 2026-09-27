import { describe, expect, it } from "vitest";

import {
  MAX_PLAYERS,
  PLAYER_COLORS,
  joinLobby,
  lobbyState,
  leaveLobby,
  startGame,
} from "./lobby";
import { mulberry32 } from "./rng";

const host = { id: "h1", name: "Host" };

describe("lobby", () => {
  it("creates a lobby state with the host assigned deterministically", () => {
    const state = lobbyState(host);
    expect(state.phase).toBe("lobby");
    expect(state.players[0].id).toBe("h1");
    expect(state.players[0].isHost).toBe(true);
    expect(state.players[0].colorToken).toBe(PLAYER_COLORS[0]);
    expect(state.decks.chance).toHaveLength(0);
  });

  it("joins players in order with deterministic colors", () => {
    let state = lobbyState(host);
    state = joinLobby(state, { id: "j1", name: "Juno" });
    state = joinLobby(state, { id: "j2", name: "Kai" });
    expect(state.players.map((p) => p.colorToken)).toEqual([
      PLAYER_COLORS[0], PLAYER_COLORS[1], PLAYER_COLORS[2],
    ]);
    expect(state.players[2].isHost).toBe(false);
  });

  it("caps the room at 6 players and rejects duplicates", () => {
    let state = lobbyState(host);
    state = joinLobby(state, { id: "p1", name: "P1" });
    expect(() => joinLobby(state, { id: "p1", name: "Dup" })).toThrow("already in room");
    for (let i = 2; i < MAX_PLAYERS; i++) {
      state = joinLobby(state, { id: `p${i}`, name: `P${i}` });
    }
    expect(state.players).toHaveLength(MAX_PLAYERS);
    expect(() => joinLobby(state, { id: "over", name: "Extra" })).toThrow("full");
  });

  it("passes host to the first remaining player when the host leaves", () => {
    let state = lobbyState(host);
    state = joinLobby(state, { id: "j1", name: "Juno" });
    state = leaveLobby(state, "h1");
    expect(state.players[0].id).toBe("j1");
    expect(state.players[0].isHost).toBe(true);
  });

  it("blocks join after start and requires 2+ players to start", () => {
    let state = lobbyState(host);
    state = joinLobby(state, { id: "j1", name: "Juno" });
    state = startGame(state, mulberry32(12345));
    expect(state.phase).toBe("playing");
    expect(state.decks.chance).toHaveLength(16);
    expect(state.decks.chest).toHaveLength(16);
    expect(state.turn.phase).toBe("preRoll");
    expect(state.turn.playerIdx).toBe(0);
    expect(() =>
      joinLobby(state, { id: "late", name: "Latecomer" })
    ).toThrow("already started");
  });

  it("deck shuffling is deterministic per seed", () => {
    const build = (seed: number) => {
      let s = lobbyState({ id: "h", name: "H" });
      s = joinLobby(s, { id: "j", name: "J" });
      return startGame(s, mulberry32(seed)).decks;
    };
    expect(build(777)).toEqual(build(777));
    expect(build(778)).not.toEqual(build(777));
  });
});
