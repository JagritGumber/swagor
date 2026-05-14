-- M5 Arc visibility: four additive nullable text columns. Two on trades
-- to record the open-anchor lifecycle separately from the existing close
-- anchor, and two on monitor_ticks to record per-tick watcher anchors.
--
-- This migration MUST be applied before the M5 code deploy. Otherwise
-- /api/arc/recent and the dashboard ArcActivityCard will 500 on missing
-- column reads.
--
-- Apply order:
--   1. Merge PR #5 to main.
--   2. Apply this migration: psql "$DATABASE_URL" -f lib/db/migrations/0001_m5_arc_visibility_columns.sql
--      OR run `bun run db:push` and accept the four ADD COLUMN prompts.
--   3. Build + deploy via `bunx opennextjs-cloudflare build && deploy`.
--
-- Idempotent: re-applying is a no-op via IF NOT EXISTS.

ALTER TABLE trades        ADD COLUMN IF NOT EXISTS open_anchor_tx        text;
--> statement-breakpoint
ALTER TABLE trades        ADD COLUMN IF NOT EXISTS open_onchain_tx_hash  text;
--> statement-breakpoint
ALTER TABLE monitor_ticks ADD COLUMN IF NOT EXISTS arc_anchor_tx         text;
--> statement-breakpoint
ALTER TABLE monitor_ticks ADD COLUMN IF NOT EXISTS arc_onchain_tx_hash   text;
