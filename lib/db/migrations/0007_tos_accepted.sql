-- Add tos_accepted_at column to selbo_instances. Null until the user
-- accepts the paper-mode disclaimer modal on first dashboard load.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE selbo_instances
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;
