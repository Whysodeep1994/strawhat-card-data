// Checks every card's effects against the engine's effect types (in .engine/, see
// fetch-engine.mjs). The engine quietly ignores a key it doesn't know, so a key in the
// wrong place makes a card do the wrong thing without any error: Loki once had
// "total cost of 4 or less" inside its filter instead of on its target, and K.O.'d any
// Character. This turns each set into TypeScript and type-checks it, so such keys fail.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(root, ".engine", "packages", "engine", "src");
const checkDir = join(root, ".shape-check");

// Fields the card files carry for people and the app, which the engine doesn't read.
const header = `import type { CardDefinition } from "${join(engine, "cards.js")}";
type Card = CardDefinition & {
  rarity?: string; text?: string; image?: string; source?: string;
  trigger?: string; notes?: unknown; errata?: unknown;
};
export const cards = [
`;
const headerLines = header.split("\n").length - 1;

const sets = readdirSync(join(root, "cards"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .sort();
const virtual = new Map();
const cardIds = new Map();
for (const set of sets) {
  const cards = JSON.parse(readFileSync(join(root, "cards", `${set}.json`), "utf8"));
  const file = join(checkDir, `${set}.ts`);
  virtual.set(
    file,
    `${header}${cards.map((c) => `  ${JSON.stringify(c)},`).join("\n")}\n] satisfies Card[];\n`,
  );
  cardIds.set(
    file,
    cards.map((c) => c.id),
  );
}

const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  types: [],
};
const host = ts.createCompilerHost(options);
const { getSourceFile, fileExists, readFile } = host;
host.getSourceFile = (name, version, ...rest) =>
  virtual.has(name)
    ? ts.createSourceFile(name, virtual.get(name), version)
    : getSourceFile.call(host, name, version, ...rest);
host.fileExists = (name) => virtual.has(name) || fileExists.call(host, name);
host.readFile = (name) => virtual.get(name) ?? readFile.call(host, name);
const program = ts.createProgram([...virtual.keys()], options, host);

const problems = [];
for (const file of virtual.keys()) {
  for (const d of ts.getPreEmitDiagnostics(program, program.getSourceFile(file))) {
    if (d.file?.fileName !== file) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    const id = cardIds.get(file)[line - headerLines] ?? "?";
    problems.push(`${id}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n  ")}`);
  }
}

// TypeScript lets a condition or cost mix keys from different kinds ({ yourTurn, handAtMost }),
// so check that every one uses the keys of a single kind.
const checker = program.getTypeChecker();
const effectsFile = program.getSourceFile(join(engine, "effects.ts"));
const kinds = {};
ts.forEachChild(effectsFile, (node) => {
  if (ts.isTypeAliasDeclaration(node) && ["Condition", "Cost"].includes(node.name.text))
    kinds[node.name.text] = checker
      .getTypeAtLocation(node.name)
      .types.map((t) => t.getProperties().map((p) => p.name));
});
const fits = (kind, value) =>
  kinds[kind].some((keys) => Object.keys(value).every((k) => keys.includes(k)));
const checkOne = (id, kind, value) => {
  if (!fits(kind, value)) problems.push(`${id}: ${JSON.stringify(value)} is not one ${kind}`);
  for (const inner of [
    ...(value.anyOf ?? []),
    ...(value.oneOf ?? []),
    ...(value.not ? [value.not] : []),
  ])
    checkOne(id, kind, inner);
};
const walk = (id, node) => {
  if (Array.isArray(node)) return node.forEach((n) => walk(id, n));
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "conditions" && Array.isArray(value))
      value.forEach((c) => checkOne(id, "Condition", c));
    if (key === "costs" && Array.isArray(value)) value.forEach((c) => checkOne(id, "Cost", c));
    walk(id, value);
  }
};
for (const set of sets)
  for (const card of JSON.parse(readFileSync(join(root, "cards", `${set}.json`), "utf8")))
    walk(card.id, card.effects);

if (problems.length > 0) {
  console.error(`${problems.length} card effect(s) don't match the engine's effect types:`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`All ${sets.length} sets match the engine's effect types.`);
