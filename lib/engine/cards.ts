/**
 * Chance and Community Chest card definitions (AGENTS.md section 9: standard sets minus
 * auction/trade-specific payments). Deck ORDER is state (shuffled index arrays); these
 * are the immutable definitions a deck index points into.
 */


export type CardEffect =
  | { kind: "money"; amount: number } // positive = collect, negative = pay
  | { kind: "moveTo"; target: number }
  | { kind: "moveBack"; steps: number }
  | { kind: "advanceToNearest"; group: "railroad" | "utility" }
  | { kind: "jailCard" }
  | { kind: "goToJail" }
  | { kind: "payEachPlayer"; amount: number }
  | { kind: "collectFromEachPlayer"; amount: number }
  | { kind: "repairs"; perHouse: number; perHotel: number };

export interface Card {
  id: number;
  deck: "chance" | "chest";
  text: string;
  effect: CardEffect;
}

const chanceCards: Omit<Card, "deck">[] = [
  { id: 0, text: "Advance to GO. Collect $200.", effect: { kind: "moveTo", target: 0 } },
  { id: 1, text: "Advance to Istanbul (24).", effect: { kind: "moveTo", target: 24 } },
  { id: 2, text: "Advance to Phuket (11).", effect: { kind: "moveTo", target: 11 } },
  {
    id: 3,
    text: "Advance to the nearest railway. Pay double rent.",
    effect: { kind: "advanceToNearest", group: "railroad" },
  },
  {
    id: 4,
    text: "Advance to the nearest railway. Pay double rent.",
    effect: { kind: "advanceToNearest", group: "railroad" },
  },
  {
    id: 5,
    text: "Advance to the nearest Utility. Pay 10× dice.",
    effect: { kind: "advanceToNearest", group: "utility" },
  },
  { id: 6, text: "Get out of Jail Free.", effect: { kind: "jailCard" } },
  { id: 7, text: "Go back 3 spaces.", effect: { kind: "moveBack", steps: 3 } },
  { id: 8, text: "Go directly to Jail. Do not pass GO.", effect: { kind: "goToJail" } },
  { id: 9, text: "Bank pays you dividend of $50.", effect: { kind: "money", amount: 50 } },
  { id: 10, text: "Pay poor tax of $15.", effect: { kind: "money", amount: -15 } },
  { id: 11, text: "Speeding fine $15.", effect: { kind: "money", amount: -15 } },
  {
    id: 12,
    text: "Make general repairs: $25/house, $100/hotel.",
    effect: { kind: "repairs", perHouse: 25, perHotel: 100 },
  },
  { id: 13, text: "Take a ride on the Trans-Sib (5).", effect: { kind: "moveTo", target: 5 } },
  { id: 14, text: "Take a trip to New York (39).", effect: { kind: "moveTo", target: 39 } },
  {
    id: 15,
    text: "Each player pays you $50.",
    effect: { kind: "collectFromEachPlayer", amount: 50 },
  },
];

const chestCards: Omit<Card, "deck">[] = [
  { id: 16, text: "Advance to GO. Collect $200.", effect: { kind: "moveTo", target: 0 } },
  { id: 17, text: "Bank error in your favor. Collect $200.", effect: { kind: "money", amount: 200 } },
  { id: 18, text: "Doctor's fee. Pay $50.", effect: { kind: "money", amount: -50 } },
  { id: 19, text: "From sale of stock you get $50.", effect: { kind: "money", amount: 50 } },
  { id: 20, text: "Get out of Jail Free.", effect: { kind: "jailCard" } },
  { id: 21, text: "Go directly to Jail.", effect: { kind: "goToJail" } },
  {
    id: 22,
    text: "Holiday fund matures. Collect $100.",
    effect: { kind: "money", amount: 100 },
  },
  { id: 23, text: "Income tax refund. Collect $20.", effect: { kind: "money", amount: 20 } },
  { id: 24, text: "It's your birthday. Collect $10 from each player.", effect: { kind: "collectFromEachPlayer", amount: 10 } },
  { id: 25, text: "Life insurance matures. Collect $100.", effect: { kind: "money", amount: 100 } },
  { id: 26, text: "Hospital fees. Pay $100.", effect: { kind: "money", amount: -100 } },
  { id: 27, text: "School fees. Pay $50.", effect: { kind: "money", amount: -50 } },
  { id: 28, text: "Consultancy fee. Collect $25.", effect: { kind: "money", amount: 25 } },
  { id: 29, text: "Fix street repairs: $40/house, $115/hotel.", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } },
  {
    id: 30,
    text: "You inherit $100.",
    effect: { kind: "money", amount: 100 },
  },
  { id: 31, text: "You won second prize in a beauty contest. Collect $10.", effect: { kind: "money", amount: 10 } },
];

export const CARDS: Card[] = [
  ...chanceCards.map((c) => ({ ...c, deck: "chance" as const })),
  ...chestCards.map((c) => ({ ...c, deck: "chest" as const })),
];

/** Fresh, NOT shuffled — the engine shuffles with the seeded RNG into state.decks. */
export function freshDecks(): { chance: number[]; chest: number[] } {
  return {
    chance: chanceCards.map((c) => c.id),
    chest: chestCards.map((c) => c.id),
  };
}

export const JAIL_CARD_IDS = [6, 20]; // one per deck ("Get out of Jail Free")
