-- Per-instance + trigger-source + error metadata on rebalance_cycles.
-- Lets the daily-plan path and the watcher path share the same table
-- while staying distinguishable in queries and the dev panel.
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP/ADD CONSTRAINT.

ALTER TABLE rebalance_cycles
  ADD COLUMN IF NOT EXISTS selbo_instance_id uuid,
  ADD COLUMN IF NOT EXISTS triggered_by text,
  ADD COLUMN IF NOT EXISTS error_message text;

--> statement-breakpoint
ALTER TABLE rebalance_cycles
  DROP CONSTRAINT IF EXISTS rebalance_cycles_triggered_by_check;
ALTER TABLE rebalance_cycles
  ADD CONSTRAINT rebalance_cycles_triggered_by_check
  CHECK (triggered_by IS NULL OR triggered_by IN ('daily', 'watcher'));

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rebalance_cycles_instance_started_idx
  ON rebalance_cycles(selbo_instance_id, started_at DESC)
  WHERE selbo_instance_id IS NOT NULL;
