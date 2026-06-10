/**
 * Dry-run of the seed's data path — parses the committed dataset exactly like
 * prisma/seed.ts does and sanity-checks it without touching a database:
 *   node scripts/verify-seed-data.mjs
 */
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "data");
const read = (f) =>
  parse(readFileSync(join(dataDir, f), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

const teams = read("worldcup2026.teams.csv");
const stadia = read("worldcup2026.stadia.csv");
const games = read("worldcup2026.games.csv");
const patches = JSON.parse(readFileSync(join(dataDir, "team-patches.json"), "utf8")).patches;

const errors = [];
const assert = (cond, msg) => {
  if (!cond) errors.push(msg);
};

assert(teams.length === 48, `expected 48 teams, got ${teams.length}`);
assert(stadia.length === 16, `expected 16 stadiums, got ${stadia.length}`);
assert(games.length === 72, `expected 72 group games, got ${games.length}`);

const teamIds = new Set(teams.map((t) => Number(t.id)));
for (const g of games) {
  assert(teamIds.has(Number(g.home_team_id)), `game ${g.id}: unknown home team ${g.home_team_id}`);
  assert(teamIds.has(Number(g.away_team_id)), `game ${g.id}: unknown away team ${g.away_team_id}`);
  assert(!isNaN(new Date(g.date).getTime()), `game ${g.id}: bad date "${g.date}"`);
  const sid = Number(g.stadium_id);
  assert(sid >= 1 && sid <= 16, `game ${g.id}: bad stadium ${g.stadium_id}`);
}

for (const [id, p] of Object.entries(patches)) {
  assert(teamIds.has(Number(id)), `patch for unknown team id ${id}`);
  assert(p.name, `patch ${id} missing name`);
}
const stillTbd = teams.filter(
  (t) => t.fifa_code === "TBD" && !patches[t.id]?.fifaCode,
);
assert(stillTbd.length === 0, `unpatched TBD teams: ${stillTbd.map((t) => t.id).join(",")}`);

const patched = (id) => patches[String(id)]?.name ?? teams.find((t) => Number(t.id) === id)?.name_en;
console.log(`teams: ${teams.length}, stadiums: ${stadia.length}, group games: ${games.length}`);
console.log(`sample: Croatia (46) → "${patched(46)}", Path D slot (4) → "${patched(4)}"`);
console.log(
  `Croatia fixtures: ${games
    .filter((g) => g.home_team_id === "46" || g.away_team_id === "46")
    .map((g) => `#${g.id} ${patched(Number(g.home_team_id))}–${patched(Number(g.away_team_id))} ${g.date.slice(0, 10)}`)
    .join(" | ")}`,
);

if (errors.length) {
  console.error("FAILED:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("✓ seed data OK");
