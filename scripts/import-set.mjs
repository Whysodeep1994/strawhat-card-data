// Imports one set from the official card list into cards/<SET>.json and images/.
//
//   node scripts/import-set.mjs ST01 569001
//   node scripts/import-set.mjs OP02 569102 OP02-001 OP02-008
//
// The second argument is the "series" number from the card list URL on
// https://en.onepiece-cardgame.com/cardlist/. Official fields (name, stats,
// text, art) are refreshed every run. Hand-written fields (aliases, keywords, effects)
// are kept, so re-running after an errata only changes what Bandai changed.
// Card numbers after the series import only those cards (for example the
// reprints in a starter deck) and keep the set's other cards in the file.
// Behind a proxy, run with NODE_USE_ENV_PROXY=1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://en.onepiece-cardgame.com";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [set, series, ...only] = process.argv.slice(2);
if (!set || !series) {
  console.error("Usage: node scripts/import-set.mjs <SET> <series number> [card numbers]");
  process.exit(1);
}

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/g, "\n")
    // Some cards print attributes as raw "<Slash>", which would look like a tag.
    .replace(/<(Slash|Strike|Ranged|Special|Wisdom)>/g, "&lt;$1&gt;")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
const field = (body, cls) => {
  const m = body.match(new RegExp(`<div class="${cls}"><h3>[\\s\\S]*?</h3>([\\s\\S]*?)</div>`));
  return m ? decode(m[1]) : null;
};
const number = (value) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

const CATEGORIES = { LEADER: "leader", CHARACTER: "character", EVENT: "event", STAGE: "stage" };

function parseCard(id, body) {
  const [, rarity, kind] = [
    ...body.match(/class="infoCol">([\s\S]*?)<\/div>/)[1].matchAll(/<span>(.*?)<\/span>/g),
  ].map((m) => decode(m[1]));
  const category = CATEGORIES[kind];
  if (!category) throw new Error(`${id}: unknown card category "${kind}"`);
  const image = body.match(/data-src="\.\.\/images\/cardlist\/card\/([^"?]+)/)[1];
  const text = field(body, "text");
  const trigger = field(body, "trigger");
  const attribute = body.match(/<div class="attribute">[\s\S]*?<i>(.*?)<\/i>/);
  // The site shows a Leader's Life in the "cost" box.
  const costBox = number(field(body, "cost"));
  const card = {
    id,
    name: decode(body.match(/class="cardName">([\s\S]*?)<\/div>/)[1]),
    category,
    colors: field(body, "color")
      .split("/")
      .map((c) => c.toLowerCase()),
    ...(category === "leader" ? { life: costBox } : { cost: costBox }),
    power: number(field(body, "power")),
    counter: number(field(body, "counter")),
    types: field(body, "feature").split("/"),
    attribute: attribute && attribute[1] ? decode(attribute[1]) : undefined,
    rarity,
    blockIcon: number(field(body, "block")) ?? (field(body, "block") === "X" ? "X" : undefined),
    text: text === "-" ? "" : text,
    trigger: trigger ? trigger : undefined,
    image: `images/${image}`,
    source: `${SITE}/cardlist/?series=${series}`,
    errata: /errata/i.test(body) || undefined,
  };
  return Object.fromEntries(Object.entries(card).filter(([, v]) => v !== undefined));
}

const res = await fetch(`${SITE}/cardlist/?series=${series}`);
if (!res.ok) throw new Error(`Card list returned ${res.status}`);
const page = await res.text();
const prints = [...page.matchAll(/<dl class="modalCol" id="([^"]+)">([\s\S]*?)<\/dl>/g)];
const found = prints
  // Alternate art prints (ids like ST01-012_p1) share their card's data.
  .filter(([, id]) => id.startsWith(set) && !id.includes("_"))
  .filter(([, id]) => only.length === 0 || only.includes(id))
  .map(([, id, body]) => parseCard(id, body));
// Some promo cards are only listed as reprints (ids like P-101_r1) on another product's page.
// When a card number asked for has no plain print here, take its first reprint instead.
const artOf = new Map();
for (const id of only) {
  if (found.some((c) => c.id === id)) continue;
  const reprint = prints.find(([, printId]) => printId.startsWith(`${id}_`));
  if (!reprint) continue;
  const card = parseCard(id, reprint[2]);
  artOf.set(id, card.image.slice("images/".length));
  card.image = `images/${id}${card.image.slice(card.image.lastIndexOf("."))}`;
  found.push(card);
}
if (found.length === 0) throw new Error(`No ${set} cards found in series ${series}`);
const missing = only.filter((id) => !found.some((c) => c.id === id));
if (missing.length > 0) throw new Error(`Not in series ${series}: ${missing.join(", ")}`);

const file = join(root, "cards", `${set}.json`);
const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
const handWritten = new Map(
  existing.map((c) => [
    c.id,
    {
      keywords: c.keywords,
      aliases: c.aliases,
      anyNumberInDeck: c.anyNumberInDeck,
      effects: c.effects,
      notes: c.notes,
    },
  ]),
);
const imported = found.map((c) => {
  const kept = handWritten.get(c.id) ?? {};
  return Object.fromEntries(Object.entries({ ...c, ...kept }).filter(([, v]) => v !== undefined));
});
const others = only.length === 0 ? [] : existing.filter((c) => !only.includes(c.id));
const cards = [...others, ...imported].sort((a, b) => a.id.localeCompare(b.id));

mkdirSync(join(root, "images"), { recursive: true });
for (const card of imported) {
  const art = await fetch(
    `${SITE}/images/cardlist/card/${artOf.get(card.id) ?? card.image.slice("images/".length)}`,
  );
  if (!art.ok) throw new Error(`${card.id}: art returned ${art.status}`);
  writeFileSync(join(root, card.image), Buffer.from(await art.arrayBuffer()));
}
writeFileSync(file, JSON.stringify(cards, null, 2) + "\n");
console.log(`Imported ${imported.length} ${set} cards into cards/${set}.json and images/.`);
