import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Tip {
  tip: string;
  source: string;
  sourceName: string;
}

const root = join(import.meta.dirname, "..");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const leaders = readdirSync(join(root, "cards"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => readJson<{ id: string; category: string }[]>(join(root, "cards", f)))
  .filter((c) => c.category === "leader")
  .map((c) => c.id);
const tips = readJson<Record<string, Tip>>(join(root, "tips", "leaders.json"));

describe("leader tips", () => {
  it("has a tip for every Leader card", () => {
    expect(leaders.filter((id) => !tips[id])).toEqual([]);
  });

  it("only has tips for Leader cards", () => {
    expect(Object.keys(tips).filter((id) => !leaders.includes(id))).toEqual([]);
  });

  for (const [id, tip] of Object.entries(tips)) {
    it(`${id} has a short tip and an official source`, () => {
      expect(tip.tip.length).toBeGreaterThan(40);
      expect(tip.tip.length).toBeLessThanOrEqual(320);
      expect(tip.source).toMatch(/^https:\/\/en\.onepiece-cardgame\.com\//);
      expect(tip.sourceName).not.toBe("");
    });
  }
});
