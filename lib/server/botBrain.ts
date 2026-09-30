import "@/lib/server/serverOnly";

/**
 * Picks a bot's move. Jev (TypeSafe AI "System One" model) chooses among the engine's
 * legal options when `TYPESAFE_API_KEY` is set; on a missing key, timeout, error, invalid
 * answer or low confidence the rule-based brain decides instead — a bot turn never hangs.
 *
 * Only public game facts are sent (no secrets, deck order or RNG), and the answer can only
 * select an engine-generated option; the engine validates the action again when applied.
 */
import { BOARD } from "@/lib/engine/board";
import { BOT_STYLE_BRIEF, botChooseRules, botOptions, type BotOption, type BotStyle } from "@/lib/engine/bots";
import type { GameState, Player } from "@/lib/engine/types";

export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
export const JEV_TIMEOUT_MS = 1500;
/** Below this the model is "not sure" and the rules decide. */
export const JEV_MIN_CONFIDENCE = 0.3;

export type BrainSource = "single" | "jev" | "rules";
export interface BrainDecision {
  option: BotOption;
  source: BrainSource;
  /** why Jev was not used (when source is "rules") */
  fallback?: "no-key" | "timeout" | "http" | "invalid" | "low-confidence";
  confidence?: number;
}

/** Memory-only counters, handy when checking that the model is really being used. */
export const brainStats: Record<BrainSource | NonNullable<BrainDecision["fallback"]>, number> = {
  single: 0, jev: 0, rules: 0, "no-key": 0, timeout: 0, http: 0, invalid: 0, "low-confidence": 0,
};

/** Compact, public-facts-only description of the position from the bot's point of view. */
export function describePosition(state: GameState, me: Player): string {
  const style = (me.botStyle ?? "balanced") as BotStyle;
  const owned = (id: string) =>
    Object.entries(state.ownership)
      .filter(([, o]) => o.ownerId === id)
      .map(([k, o]) => `${BOARD[Number(k)].name}${o.houses >= 5 ? " (hotel)" : o.houses ? ` (${o.houses} houses)` : ""}${o.mortgaged ? " (mortgaged)" : ""}`);
  const lines = [
    "You are playing a Monopoly-style property game as a bot.",
    `Your personality: ${BOT_STYLE_BRIEF[style]}`,
    `You: cash $${me.money}, standing on ${BOARD[me.position]?.name ?? "?"}${me.inJail ? " (in jail)" : ""}. You own: ${owned(me.id).join(", ") || "nothing yet"}.`,
  ];
  for (const p of state.players) {
    if (p.id === me.id || p.bankrupt) continue;
    lines.push(`Rival ${p.name}: cash $${p.money}. Owns: ${owned(p.id).join(", ") || "nothing"}.`);
  }
  lines.push(`Turn ${state.log.filter((e) => e.kind === "turn").length}. Goal: be the last player with money.`);
  return lines.join("\n");
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

async function askJev(state: GameState, me: Player, options: BotOption[], apiKey: string, fetchImpl: FetchLike): Promise<{ id: string; confidence: number } | "timeout" | "http" | "invalid"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    const res = await fetchImpl(JEV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: JEV_MODEL,
        state: describePosition(state, me),
        questions: {
          move: {
            type: "choice",
            instructions: "Which move should you make now, playing in character with your personality?",
            criteria: Object.fromEntries(options.map((o) => [o.id, o.label])),
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return "http";
    const data = (await res.json()) as { answers?: { move?: { choice?: unknown; confidence?: unknown } } };
    const move = data?.answers?.move;
    if (typeof move?.choice !== "string" || !options.some((o) => o.id === move.choice)) return "invalid";
    return { id: move.choice, confidence: typeof move.confidence === "number" ? move.confidence : 0 };
  } catch (e) {
    return (e as { name?: string })?.name === "AbortError" ? "timeout" : "http";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decide the acting bot's move. Returns null when it is not a bot's turn.
 * `deps` exists for tests (fake fetch / explicit key).
 */
export async function decideBotMove(
  state: GameState,
  deps: { apiKey?: string | undefined; fetchImpl?: FetchLike } = {}
): Promise<BrainDecision | null> {
  const options = botOptions(state);
  if (options.length === 0) return null;
  const me = state.players[state.turn.playerIdx];
  const count = (d: BrainDecision) => {
    brainStats[d.source] += 1;
    if (d.fallback) brainStats[d.fallback] += 1;
    return d;
  };
  if (options.length === 1) return count({ option: options[0], source: "single" });

  const rules = (): BotOption => botChooseRules(state, options) ?? options[0];
  const apiKey = "apiKey" in deps ? deps.apiKey : process.env.TYPESAFE_API_KEY;
  if (!apiKey) return count({ option: rules(), source: "rules", fallback: "no-key" });

  const answer = await askJev(state, me, options, apiKey, deps.fetchImpl ?? (fetch as unknown as FetchLike));
  if (typeof answer === "string") return count({ option: rules(), source: "rules", fallback: answer });
  if (answer.confidence < JEV_MIN_CONFIDENCE) {
    return count({ option: rules(), source: "rules", fallback: "low-confidence", confidence: answer.confidence });
  }
  return count({ option: options.find((o) => o.id === answer.id)!, source: "jev", confidence: answer.confidence });
}
