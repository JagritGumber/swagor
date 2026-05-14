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
  IF to_regclass('public.solon_instances') IS NOT NULL
     AND to_regclass('public.selbo_instances') IS NULL THEN
    ALTER TABLE public.solon_instances RENAME TO selbo_instances;
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
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'monitor_ticks'
      AND column_name = 'selbo_instance_id'
  ) THEN
    ALTER TABLE public.monitor_ticks RENAME COLUMN solon_instance_id TO selbo_instance_id;
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  ALTER INDEX IF EXISTS public.solon_instances_pkey RENAME TO selbo_instances_pkey;
  ALTER INDEX IF EXISTS public.solon_instances_user_id_unique RENAME TO selbo_instances_user_id_unique;
  ALTER INDEX IF EXISTS public.solon_instances_circle_wallet_id_unique RENAME TO selbo_instances_circle_wallet_id_unique;
  ALTER INDEX IF EXISTS public.solon_instances_billing_customer_id_unique RENAME TO selbo_instances_billing_customer_id_unique;
  ALTER INDEX IF EXISTS public.solon_instances_billing_subscription_id_unique RENAME TO selbo_instances_billing_subscription_id_unique;
  ALTER INDEX IF EXISTS public.solon_instances_username_unique RENAME TO selbo_instances_username_unique;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
