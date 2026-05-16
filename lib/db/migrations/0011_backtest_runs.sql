-- Backtest harness: one row per multi-day replay invocation. Children
-- (daily_plans + rebalance_cycles rows produced by the backtest) carry
-- the same backtest_run_id so the dev panel can list them together
-- without polluting the live Brain page.

CREATE TABLE IF NOT EXISTS backtest_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text NOT NULL,
  selbo_instance_id  uuid NOT NULL,
  start_date         text NOT NULL,
  end_date           text NOT NULL,
  days               integer NOT NULL,
  status             text NOT NULL,
  cycles_requested   integer NOT NULL,
  cycles_completed   integer NOT NULL DEFAULT 0,
  cycles_failed      integer NOT NULL DEFAULT 0,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);

--> statement-breakpoint
ALTER TABLE backtest_runs
  DROP CONSTRAINT IF EXISTS backtest_runs_status_check;
ALTER TABLE backtest_runs
  ADD CONSTRAINT backtest_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed'));

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS backtest_runs_user_id_created_at_idx
  ON backtest_runs(user_id, created_at DESC);

--> statement-breakpoint
ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS backtest_run_id uuid;
--> statement-breakpoint
ALTER TABLE rebalance_cycles
  ADD COLUMN IF NOT EXISTS backtest_run_id uuid;
--> statement-breakpoint
ALTER TABLE rebalance_cycles
  ADD COLUMN IF NOT EXISTS as_of timestamptz;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS daily_plans_backtest_run_id_idx
  ON daily_plans(backtest_run_id) WHERE backtest_run_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rebalance_cycles_backtest_run_id_idx
  ON rebalance_cycles(backtest_run_id) WHERE backtest_run_id IS NOT NULL;
