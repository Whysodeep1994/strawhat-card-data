// Downloads the rules engine at the commit pinned in engine.json into .engine/,
// so card scenarios run against a known engine version. Bump the commit to
// test cards against a newer engine.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { repository, commit } = JSON.parse(readFileSync(join(root, "engine.json"), "utf8"));
const dir = join(root, ".engine");
const git = (...args) => execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" }).toString();

if (!existsSync(dir)) execFileSync("git", ["clone", "--quiet", repository, dir]);
if (git("rev-parse", "HEAD").trim() !== commit) {
  git("fetch", "--quiet", "origin", commit);
  git("checkout", "--quiet", "--detach", commit);
}
console.log(`Engine ready at ${commit.slice(0, 7)}.`);
