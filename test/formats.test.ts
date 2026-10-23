import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Format {
  id: string;
  name: string;
  effective: string;
  source: string[];
  deckSize: number;
  maxCopies: number;
  legalBlocks?: (number | "X")[];
  alwaysLegal?: string[];
  treatedAsBlock?: Record<string, number>;
  banned: string[];
  restricted: Record<string, number>;
  bannedPairs: [string, string][];
  notes: string;
}

const root = join(import.meta.dirname, "..");
const CARD_NUMBER = /^(OP|ST|EB|PRB|P)\d*-\d{3}$/;
const files = readdirSync(join(root, "formats")).filter((f) => f.endsWith(".json"));

describe("formats", () => {
  it("has a Standard format", () => expect(files).toContain("standard.json"));

  for (const file of files) {
    const format = JSON.parse(readFileSync(join(root, "formats", file), "utf8")) as Format;
    describe(file, () => {
      it("has an id matching its file name, a date, and official sources", () => {
        expect(`${format.id}.json`).toBe(file);
        expect(format.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(format.source.length).toBeGreaterThan(0);
        for (const url of format.source)
          expect(url).toMatch(/^https:\/\/en\.onepiece-cardgame\.com\//);
      });

      it("uses real card numbers everywhere", () => {
        const ids = [
          ...format.banned,
          ...Object.keys(format.restricted),
          ...format.bannedPairs.flat(),
          ...(format.alwaysLegal ?? []),
          ...Object.keys(format.treatedAsBlock ?? {}),
        ];
        for (const id of ids) expect(id).toMatch(CARD_NUMBER);
      });

      it("never lists a card twice in conflicting ways", () => {
        expect(new Set(format.banned).size).toBe(format.banned.length);
        for (const id of format.banned) expect(format.restricted[id]).toBeUndefined();
        for (const max of Object.values(format.restricted)) {
          expect(max).toBeGreaterThan(0);
          expect(max).toBeLessThan(format.maxCopies);
        }
        for (const pair of format.bannedPairs) {
          expect(pair).toHaveLength(2);
          expect(pair[0]).not.toBe(pair[1]);
        }
      });
    });
  }
});
