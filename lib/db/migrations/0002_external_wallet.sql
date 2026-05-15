-- Add external_wallet_address column to selbo_instances and enforce uniqueness.
-- Idempotent: ADD COLUMN IF NOT EXISTS plus a unique index that's created
-- only when missing. Apply before deploying the gate that requires it; existing
-- rows get NULL and will be forced through /verify-wallet on next dashboard load.

ALTER TABLE selbo_instances ADD COLUMN IF NOT EXISTS external_wallet_address text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS selbo_instances_external_wallet_address_unique
  ON selbo_instances(external_wallet_address);
