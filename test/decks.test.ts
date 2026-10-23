import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Card {
  id: string;
  name: string;
  category: string;
  colors: string[];
}

interface Deck {
  id: string;
  name: string;
  leader: string;
  cards: Record<string, number>;
  source: string;
}

const root = join(import.meta.dirname, "..");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const catalog = new Map(
  readdirSync(join(root, "cards"))
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => readJson<Card[]>(join(root, "cards", f)))
    .map((c) => [c.id, c]),
);
const decksDir = join(root, "decks");
const files = existsSync(decksDir) ? readdirSync(decksDir).filter((f) => f.endsWith(".json")) : [];

describe("decks", () => {
  // Keeps the suite valid while no deck lists have been added yet.
  it("reads every deck file", () => expect(files.every((f) => f.endsWith(".json"))).toBe(true));

  for (const file of files) {
    const deck = readJson<Deck>(join(root, "decks", file));
    describe(`${deck.id} ${deck.name}`, () => {
      it("has an id matching its file name and a source", () => {
        expect(`${deck.id}.json`).toBe(file);
        expect(deck.source).toMatch(/^https:\/\//);
      });

      it("has a Leader card that exists", () => {
        expect(catalog.get(deck.leader)?.category).toBe("leader");
      });

      it("has exactly 50 cards and at most 4 copies of each", () => {
        const counts = Object.values(deck.cards);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(50);
        for (const n of counts) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThan(0);
          expect(n).toBeLessThanOrEqual(4);
        }
      });

      it("only uses cards that exist, are not Leaders, and share a colour with the Leader", () => {
        const leaderColors = catalog.get(deck.leader)?.colors ?? [];
        for (const id of Object.keys(deck.cards)) {
          const card = catalog.get(id);
          expect(card, id).toBeDefined();
          expect(card?.category, id).not.toBe("leader");
          expect(
            card?.colors.some((c) => leaderColors.includes(c)),
            `${id} ${card?.colors.join("/")}`,
          ).toBe(true);
        }
      });
    });
  }
});
