-- Daily-plan rows produced by the scheduled swarm cron. One row per UTC
-- day per active Selbo instance. Watcher-triggered cycles write to
-- rebalance_cycles only; they do NOT overwrite the user-facing daily
-- plan. Idempotent: CREATE TABLE IF NOT EXISTS + ADD CONSTRAINT IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS daily_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,
  selbo_instance_id   uuid NOT NULL,
  cycle_id            uuid NOT NULL,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL,
  plan_markdown       text,
  plan_json           jsonb,
  error_message       text
);

--> statement-breakpoint
ALTER TABLE daily_plans
  DROP CONSTRAINT IF EXISTS daily_plans_status_check;
ALTER TABLE daily_plans
  ADD CONSTRAINT daily_plans_status_check
  CHECK (status IN ('pending', 'complete', 'failed'));

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS daily_plans_user_id_generated_at_idx
  ON daily_plans(user_id, generated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS daily_plans_instance_id_generated_at_idx
  ON daily_plans(selbo_instance_id, generated_at DESC);
