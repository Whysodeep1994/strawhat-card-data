import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runScenario,
  type CardCatalog,
  type CardDefinition,
  type Scenario,
} from "../.engine/packages/engine/src/index.js";

const root = join(import.meta.dirname, "..");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const allSets = readdirSync(join(root, "cards"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .sort();
const cardsBySet = new Map(
  allSets.map((set) => [set, readJson<CardDefinition[]>(join(root, "cards", `${set}.json`))]),
);
const helpers = readJson<CardDefinition[]>(join(root, "test", "helper-cards.json"));
const catalog: CardCatalog = Object.fromEntries(
  [...[...cardsBySet.values()].flat(), ...helpers].map((c) => [c.id, c]),
);

/**
 * Defines the card tests for every `of`-th set, starting at `part`. The tests are split
 * across several files so that no single test file runs long enough for vitest's worker
 * to time out, and so the files run in parallel.
 */
export function cardTests(part: number, of: number): void {
  // The scenarios run synchronously, so without a pause the worker never gets to answer
  // vitest's progress messages and they time out. Letting the event loop turn after each
  // test keeps those messages flowing.
  afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
  for (const [set, cards] of cardsBySet) {
    if (allSets.indexOf(set) % of !== part) continue;
    describe(set, () => {
      const dir = join(root, "scenarios", set);
      const scenarios = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .sort()
        : [];

      for (const card of cards) {
        describe(`${card.id} ${card.name}`, () => {
          it("has its card number, art, and at least one scenario", () => {
            expect(card.id.startsWith(set)).toBe(true);
            expect(existsSync(join(root, (card as { image?: string }).image ?? ""))).toBe(true);
            expect(scenarios.some((f) => f.startsWith(`${card.id}-`))).toBe(true);
          });

          for (const file of scenarios.filter((f) => f.startsWith(`${card.id}-`))) {
            const scenario = readJson<Scenario>(join(dir, file));
            it(`${file}: ${scenario.name}`, () => {
              expect(runScenario(scenario, catalog)).toEqual([]);
            });
          }
        });
      }

      it("has no scenarios for unknown cards", () => {
        const ids = new Set(cards.map((c) => c.id));
        for (const file of scenarios)
          expect(ids.has(file.slice(0, file.indexOf("-", set.length + 1)))).toBe(true);
      });
    });
  }
}
