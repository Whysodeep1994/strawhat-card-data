import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { runScenario, buildScenarioState, applyAction } from "/home/user/strawhat-simulator/packages/engine/src/index.js";
const root = "/home/user/strawhat-card-data";
const catalog: Record<string, any> = {};
for (const f of readdirSync(join(root, "cards"))) for (const c of JSON.parse(readFileSync(join(root, "cards", f), "utf8"))) catalog[c.id] = c;
for (const c of JSON.parse(readFileSync(join(root, "test/helper-cards.json"), "utf8"))) catalog[c.id] = c;
const want = (process.env.SC ?? "").split(",");
it("debug", () => {
  for (const w of want) {
    const set = w.slice(0, w.indexOf("-"));
    const file = join(root, "scenarios", set, w + ".json");
    const sc = JSON.parse(readFileSync(file, "utf8"));
    console.log(w, JSON.stringify(runScenario(sc, catalog)));
  }
});
