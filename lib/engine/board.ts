/**
 * The 40-space board. Index 0 is GO, then clockwise.
 * Values follow the classic Monopoly neighborhood; exact Hasbro numbers are not a goal
 * (AGENTS.md section 9). This is data — a themed board is a new version of this file.
 */
import type { BoardSpace } from "./types";

export type GroupId = "brown" | "lightblue" | "pink" | "orange" | "red" | "yellow" | "green" | "darkblue" | "railroad" | "utility";

export const GROUP_COLORS: Record<GroupId, string> = {
  brown: "#955436",
  lightblue: "#aae0fa",
  pink: "#d93a96",
  orange: "#f7941d",
  red: "#ed1b24",
  yellow: "#fef200",
  green: "#1fb25a",
  darkblue: "#0072bb",
  railroad: "#2d2d2d",
  utility: "#8fd18f",
};

/** rentLadder: [base, 1 house, 2 houses, 3 houses, 4 houses, hotel] */
const property = (
  index: number,
  name: string,
  group: GroupId,
  price: number,
  rentLadder: [number, number, number, number, number, number],
  houseCost: number
): BoardSpace => ({
  index,
  name,
  type: "property",
  group,
  price,
  rentLadder,
  houseCost,
  mortgageValue: Math.round(price / 2),
});

const railroad = (index: number, name: string, price = 200): BoardSpace => ({
  index,
  name,
  type: "railroad",
  group: "railroad",
  price,
  mortgageValue: Math.round(price / 2),
});

const utility = (index: number, name: string, price = 150): BoardSpace => ({
  index,
  name,
  type: "utility",
  group: "utility",
  price,
  mortgageValue: Math.round(price / 2),
});

const chance = (index: number): BoardSpace => ({ index, name: "Chance", type: "chance" });
const chest = (index: number): BoardSpace => ({ index, name: "Community Chest", type: "chest" });

export const BOARD: BoardSpace[] = [
  { index: 0, name: "GO", type: "go", effect: { kind: "go" } },
  property(1, "Sicily", "brown", 60, [2, 10, 30, 90, 160, 250], 50),
  chest(2),
  property(3, "Milan", "brown", 60, [4, 20, 60, 180, 320, 450], 50),
  { index: 4, name: "Income Tax", type: "tax", effect: { kind: "incomeTax", amount: 200 } },
  railroad(5, "Trans-Sib"),
  property(6, "Kyoto", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
  chance(7),
  property(8, "Osaka", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
  property(9, "Tokyo", "lightblue", 120, [8, 40, 100, 300, 450, 600], 50),
  { index: 10, name: "Jail / Just Visiting", type: "jail", effect: { kind: "jail" } },
  property(11, "Phuket", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
  utility(12, "Power Grid"),
  property(13, "Chiang Mai", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
  property(14, "Bangkok", "pink", 160, [12, 60, 180, 500, 700, 900], 100),
  railroad(15, "Orient Exp."),
  property(16, "Seville", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
  chest(17),
  property(18, "Madrid", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
  property(19, "Barcelona", "orange", 200, [16, 80, 220, 600, 800, 1000], 100),
  { index: 20, name: "Free Parking", type: "parking", effect: { kind: "parking" } },
  property(21, "Antalya", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
  chance(22),
  property(23, "Izmir", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
  property(24, "Istanbul", "red", 240, [20, 100, 300, 750, 925, 1100], 150),
  railroad(25, "Eurostar"),
  property(26, "Cologne", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
  property(27, "Munich", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
  utility(28, "Water Works"),
  property(29, "Berlin", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150),
  { index: 30, name: "Go To Jail", type: "gotojail", effect: { kind: "goToJail" } },
  property(31, "Salvador", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
  property(32, "Rio", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
  chest(33),
  property(34, "São Paulo", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200),
  railroad(35, "Shinkansen"),
  chance(36),
  property(37, "Miami", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { index: 38, name: "Luxury Tax", type: "tax", effect: { kind: "luxuryTax", amount: 100 } },
  property(39, "New York", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

if (BOARD.length !== 40) throw new Error(`Board must have 40 spaces, got ${BOARD.length}`);
BOARD.forEach((space, i) => {
  if (space.index !== i) throw new Error(`Board space ${i} has misordered index ${space.index}`);
});

export const RAILROAD_BASE_RENT = 25;
export const UTILITY_MULTIPLIER_DICE = 4;
export const UTILITY_MULTIPLIER_BOTH = 10;
