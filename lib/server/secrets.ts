import { randomInt, randomBytes } from "node:crypto";

/** URL-safe server secret (player auth token). Server-only usage. */
export function newSecret(): string {
  return randomBytes(16).toString("hex");
}

/** Short local player id: "p-" + 8 hex chars. */
export function newPlayerId(): string {
  return `p-${randomInt(0x100000000).toString(16).padStart(8, "0")}`;
}
