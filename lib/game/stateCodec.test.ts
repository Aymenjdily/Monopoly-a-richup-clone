import { describe, expect, it } from "vitest";

import { lobbyState, joinLobby, startGame } from "@/lib/engine/lobby";
import { applyAction } from "@/lib/engine/engine";
import { mulberry32 } from "@/lib/engine/rng";
import type { GameState } from "@/lib/engine/types";
import {
  deserializeState,
  publicRoomView,
  sanitizedClientState,
  serializeState,
} from "./stateCodec";

function buildStateWithOwnership(): GameState {
  let state = lobbyState({ id: "h1", name: "Host" });
  state = joinLobby(state, { id: "j1", name: "Juno" });
  state = startGame(state, mulberry32(3));
  // the server assigns secrets after deserializing state out of the DB
  state.players[0].secret = "host-secret-abc";
  state.ownership[6] = { ownerId: "h1", houses: 0, mortgaged: false };
  state.ownership[8] = { ownerId: "h1", houses: 0, mortgaged: false };
  state.ownership[9] = { ownerId: "h1", houses: 0, mortgaged: false };
  return state;
}

describe("stateCodec", () => {
  it("survives 2× JSON roundtrips keeping numeric ownership keys", () => {
    const state = buildStateWithOwnership();
    const encoded = JSON.parse(JSON.stringify(serializeState(state)));
    let restored = deserializeState(encoded);
    expect(restored.ownership[6]?.ownerId).toBe("h1");
    // second roundtrip through the engine itself:
    const again = applyAction({
      state: restored,
      playerId: "h1",
      action: { type: "build", spaceIndex: 6 },
      rng: mulberry32(9),
    });
    expect(again.ok).toBe(true);
    restored = deserializeState(JSON.parse(JSON.stringify(serializeState(again.state))));
    expect(restored.ownership[6]?.houses).toBe(1);
  });

  it("strips secrets and deck order from the client view", () => {
    const state = buildStateWithOwnership();
    const view = sanitizedClientState(state);
    expect(view.players.every((p) => p.secret === "")).toBe(true);
    expect(state.players.some((p) => p.secret !== "")).toBe(true);
    expect(view.decks.chance).toHaveLength(0);
    expect(state.decks.chance.length).toBeGreaterThan(0);
  });

  it("public room view contains no gameplay state", () => {
    const state = buildStateWithOwnership();
    const raw = JSON.stringify(publicRoomView("ABC234", state));
    expect(raw).not.toContain("decks");
    expect(raw).not.toContain("secret");
    expect(raw).not.toContain("ownership");
    expect(raw).not.toContain("jailCards");
    const players = state.players;
    expect(players.some((p) => p.secret !== "")).toBe(true);
    const parsed = JSON.parse(raw) as { players: { secret?: string }[] };
    expect(parsed.players[0].secret).toBeUndefined();
  });
});
