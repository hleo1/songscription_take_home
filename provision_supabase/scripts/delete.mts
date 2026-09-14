// Drops every table and function in the public schema — the whole app schema
// from provision_supabase/migrations, with all its data. Storage files are not touched.
// Needs DATABASE_URL in .env.local (Database → Connection → Session pooler, 5432).
// Run:  npm run db:delete   (or `npm run db:reset` to delete, migrate and seed)
import postgres from "postgres";

process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL in .env.local (Supabase → Database → Connection → Session pooler, port 5432).",
  );
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
try {
  const tables = await sql`
    select tablename from pg_tables where schemaname = 'public' order by 1`;
  const functions = await sql`
    select oid::regprocedure::text as signature from pg_proc
    where pronamespace = 'public'::regnamespace order by 1`;
  // One transaction, so a failure leaves the schema as it was.
  await sql.begin(async (tx) => {
    if (tables.length)
      await tx.unsafe(
        `drop table ${tables.map((t) => `public."${t.tablename}"`).join(", ")} cascade`,
      );
    for (const f of functions) await tx.unsafe(`drop function ${f.signature}`);
  });
  console.log(
    `Dropped ${tables.length} tables and ${functions.length} functions from public.`,
  );
} catch (e) {
  console.error("Delete failed:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
