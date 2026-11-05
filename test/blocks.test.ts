import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The block icon every card in a set carries, checked against Bandai's Japanese and English
 * (Asia) card lists. The English (NA/EU) card list wrongly shows block 1 on most OP-05 cards,
 * which once kept legal cards such as OP05-017 Lindbergh out of Standard decks. Cards marked "X"
 * (Super Parallel Rare numbers) are allowed in any set. Promo (P) cards vary, so they aren't listed.
 */
const SET_BLOCK: Record<string, number> = {
  OP01: 1,
  OP02: 1,
  OP03: 1,
  OP04: 1,
  OP05: 2,
  OP06: 2,
  OP07: 2,
  OP08: 2,
  OP09: 3,
  OP10: 3,
  OP11: 3,
  OP12: 3,
  OP13: 4,
  OP14: 4,
  OP15: 4,
  OP16: 5,
  OP17: 5,
  EB01: 2,
  EB02: 3,
  EB03: 4,
  EB04: 4,
  EB05: 5,
  PRB01: 3,
  PRB02: 3,
  ST01: 1,
  ST02: 1,
  ST03: 1,
  ST04: 1,
  ST05: 1,
  ST06: 1,
  ST07: 1,
  ST08: 1,
  ST09: 1,
  ST10: 2,
  ST11: 2,
  ST12: 2,
  ST13: 2,
  ST14: 2,
  ST15: 3,
  ST16: 3,
  ST17: 3,
  ST18: 3,
  ST19: 3,
  ST20: 3,
  ST21: 3,
  ST22: 3,
  ST23: 3,
  ST24: 3,
  ST25: 3,
  ST26: 3,
  ST27: 3,
  ST28: 3,
  ST29: 4,
  ST30: 5,
  ST31: 5,
  ST32: 5,
  ST33: 5,
  ST34: 5,
  ST35: 5,
  ST36: 5,
};

const root = join(import.meta.dirname, "..");
const files = readdirSync(join(root, "cards")).filter((f) => f.endsWith(".json"));

describe("block icons", () => {
  for (const file of files) {
    const set = file.replace(/\.json$/, "");
    if (set === "P") continue;
    it(`${set} cards carry the set's block icon`, () => {
      expect(SET_BLOCK[set], `add ${set} to SET_BLOCK`).toBeDefined();
      const cards = JSON.parse(readFileSync(join(root, "cards", file), "utf8")) as {
        id: string;
        blockIcon?: number | string;
      }[];
      const wrong = cards
        .filter((c) => c.blockIcon !== SET_BLOCK[set] && c.blockIcon !== "X")
        .map((c) => `${c.id}: ${String(c.blockIcon)}`);
      expect(wrong).toEqual([]);
    });
  }
});
