-- Rename solon_instances table to selbo_instances and the FK column
-- monitor_ticks.solon_instance_id to selbo_instance_id.
--
-- This migration is required because the schema (lib/db/schema/*) was
-- updated to reference the new physical names. Running `bun run db:push`
-- against an existing database WITHOUT first applying this migration
-- would prompt drizzle-kit to drop/recreate the table, losing all rows
-- (wallet bindings, beta access, strategy text, watchlists, billing IDs,
-- kill-switch state).
--
-- Apply once, before the first `db:push` on the new schema:
--   psql "$DATABASE_URL" -f lib/db/migrations/0000_rename_solon_to_selbo.sql
-- or paste into the Supabase SQL editor.
--
-- Idempotent: each statement is guarded so re-applying is a no-op.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'solon_instances') THEN
    ALTER TABLE solon_instances RENAME TO selbo_instances;
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'monitor_ticks'
      AND column_name = 'solon_instance_id'
  ) THEN
    ALTER TABLE monitor_ticks RENAME COLUMN solon_instance_id TO selbo_instance_id;
  END IF;
END $$;
