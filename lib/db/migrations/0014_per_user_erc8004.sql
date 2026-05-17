-- Per-user ERC-8004 agent identity. Each Selbo instance mints its own
-- IdentityRegistry NFT at signup, signed by the user's Circle Dev Wallet.
-- Replaces the single global SELBO_AGENT_ID env var pattern. Both
-- columns are nullable; ensureSelboInstance fires registration as a
-- fire-and-forget background job that fills them in within seconds of
-- signup.

ALTER TABLE selbo_instances
  ADD COLUMN IF NOT EXISTS erc8004_token_id text;
--> statement-breakpoint
ALTER TABLE selbo_instances
  ADD COLUMN IF NOT EXISTS erc8004_registration_tx_hash text;
--> statement-breakpoint
-- Lookup index for the Track Record page (find an instance by its agent id).
CREATE INDEX IF NOT EXISTS selbo_instances_erc8004_token_id_idx
  ON selbo_instances(erc8004_token_id) WHERE erc8004_token_id IS NOT NULL;
