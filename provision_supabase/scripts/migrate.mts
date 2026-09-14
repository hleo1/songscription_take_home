// Applies provision_supabase/migrations/*.sql over a direct Postgres connection.
// Needs DATABASE_URL in .env.local (Database → Connection → Session pooler, 5432).
// Run:  npm run db:migrate
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL in .env.local (Supabase → Database → Connection → Session pooler, port 5432).",
  );
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const dir = "provision_supabase/migrations";
try {
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".sql")) continue;
    await sql.unsafe(readFileSync(join(dir, file), "utf8")).simple();
    console.log(`applied ${file}`);
  }
  console.log("Schema is up to date.");
} catch (e) {
  console.error("Migration failed:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
