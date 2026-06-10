/**
 * Local dev database without Docker: real Postgres binaries managed by
 * embedded-postgres, listening on 5433 with data in ./.pgdata (gitignored).
 *   node scripts/dev-db.mjs
 * Keep it running; stop with Ctrl+C.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = join(root, ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

if (!existsSync(join(databaseDir, "PG_VERSION"))) {
  console.log("initialising data dir…");
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("pentix");
  console.log("created database pentix");
} catch {
  console.log("database pentix already exists");
}
console.log("ready: postgresql://postgres:postgres@localhost:5433/pentix");

const shutdown = async () => {
  console.log("stopping…");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
