-- Per-tick equity snapshots for the dashboard equity curve + balance delta.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS equity_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               text NOT NULL,
  selbo_instance_id     uuid NOT NULL,
  equity_usd            numeric(20, 6) NOT NULL,
  withdrawable_usd      numeric(20, 6) NOT NULL,
  open_positions_count  integer NOT NULL DEFAULT 0,
  taken_at              timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS equity_snapshots_user_id_taken_at_idx
  ON equity_snapshots(user_id, taken_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS equity_snapshots_instance_id_taken_at_idx
  ON equity_snapshots(selbo_instance_id, taken_at DESC);
