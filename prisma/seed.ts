/**
 * Seeds World Cup 2026 reference data (teams, stadiums, 104-match schedule
 * template) from static files committed to the repo — no runtime dependency
 * on any external API. Idempotent: re-running upserts.
 *
 *   npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOCKOUT_TEMPLATE } from "./knockout-template";

const prisma = new PrismaClient();
const dataDir = join(__dirname, "data");

function readCsv(file: string): Record<string, string>[] {
  return parse(readFileSync(join(dataDir, file), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

/**
 * The dataset's wikimedia flag URLs started returning 400s, so flags come
 * from flagcdn.com keyed by ISO code (gb-eng/gb-sct for the home nations).
 */
function flagFromIso(iso2: string | null): string | null {
  if (!iso2) return null;
  const special: Record<string, string> = { ENG: "gb-eng", SCO: "gb-sct" };
  const code =
    special[iso2.toUpperCase()] ??
    (iso2.length === 2 ? iso2.toLowerCase() : null);
  return code ? `https://flagcdn.com/w160/${code}.png` : null;
}

async function seedTeams() {
  const rows = readCsv("worldcup2026.teams.csv");
  const patchFile = JSON.parse(
    readFileSync(join(dataDir, "team-patches.json"), "utf8"),
  ) as {
    patches: Record<
      string,
      { name?: string; fifaCode?: string; iso2?: string; flagUrl?: string }
    >;
  };

  for (const row of rows) {
    const id = Number(row.id);
    const patch = patchFile.patches[String(id)] ?? {};
    const iso2 = patch.iso2 ?? (row.iso2 === "TBD" ? null : row.iso2 || null);
    const data = {
      name: patch.name ?? row.name_en,
      fifaCode: patch.fifaCode ?? row.fifa_code,
      iso2,
      flagUrl: patch.flagUrl ?? flagFromIso(iso2) ?? (row.flag || null),
      groupLetter: row.groups || null,
    };
    await prisma.team.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  console.log(`✓ ${rows.length} teams`);
}

async function seedStadiums() {
  const rows = readCsv("worldcup2026.stadia.csv");
  for (const row of rows) {
    const id = Number(row.id);
    const data = {
      name: row.name_en,
      city: row.city_en,
      country: row.country_en,
      capacity: row.capacity ? Number(row.capacity) : null,
    };
    await prisma.stadium.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  console.log(`✓ ${rows.length} stadiums`);
}

async function seedGroupMatches() {
  const rows = readCsv("worldcup2026.games.csv");
  for (const row of rows) {
    const id = Number(row.id);
    const data = {
      phase: "GROUP" as const,
      homeTeamId: Number(row.home_team_id),
      awayTeamId: Number(row.away_team_id),
      homeSlot: null,
      awaySlot: null,
      kickoff: new Date(row.date),
      stadiumId: row.stadium_id ? Number(row.stadium_id) : null,
      groupLetter: row.group || null,
      matchday: row.matchday ? Number(row.matchday) : null,
    };
    await prisma.templateMatch.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
  console.log(`✓ ${rows.length} group-stage matches`);
}

async function seedKnockoutMatches() {
  for (const m of KNOCKOUT_TEMPLATE) {
    const data = {
      phase: m.phase,
      homeTeamId: null,
      awayTeamId: null,
      homeSlot: "TBD",
      awaySlot: "TBD",
      kickoff: new Date(m.kickoff),
      stadiumId: m.stadiumId,
      groupLetter: null,
      matchday: null,
    };
    await prisma.templateMatch.upsert({
      where: { id: m.id },
      create: { id: m.id, ...data },
      update: data,
    });
  }
  console.log(`✓ ${KNOCKOUT_TEMPLATE.length} knockout matches`);
}

async function main() {
  await seedTeams();
  await seedStadiums();
  await seedGroupMatches();
  await seedKnockoutMatches();
  const total = await prisma.templateMatch.count();
  console.log(`Schedule template: ${total} matches total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
