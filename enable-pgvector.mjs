/**
 * One-time helper: enable the pgvector extension on the linked Supabase Postgres.
 * Needed before drizzle-kit push can create the `nodes.embedding vector(1536)` column.
 *
 * Usage: node enable-pgvector.mjs
 * (Idempotent; safe to re-run.)
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL not set in .env.local");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });
try {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension enabled (or already present)");
} catch (err) {
  console.error("Failed to enable pgvector:", err.message);
  console.error(
    "If this is a permissions error, enable it manually via Supabase Dashboard:"
  );
  console.error("Database -> Extensions -> search 'vector' -> toggle on");
  process.exit(1);
} finally {
  await sql.end();
}
