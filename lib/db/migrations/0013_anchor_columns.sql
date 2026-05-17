-- Slice 2 of the anchoring phase: every daily analysis (live + backtest)
-- gets a content-hash anchor on the Arc PortfolioDecisions contract.
--   arc_anchor_tx      Circle SDK tx id returned synchronously when the
--                      anchorDailyAnalysis call is queued.
--   arc_onchain_tx_hash Backfilled by the heartbeat poller once Circle
--                      reports state=COMPLETE. Sentinel `failed:STATE`
--                      stamped here if the tx terminally fails.
-- Backtest analyses anchor via the same function with a `backtest:...`
-- tag prefix; both live and backtest rows live in `daily_plans` already.

ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS arc_anchor_tx text;
--> statement-breakpoint
ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS arc_onchain_tx_hash text;
--> statement-breakpoint
-- Partial index so the poller's "pending anchor" scan is O(pending) not O(rows).
CREATE INDEX IF NOT EXISTS daily_plans_pending_anchor_idx
  ON daily_plans(generated_at)
  WHERE arc_anchor_tx IS NOT NULL AND arc_onchain_tx_hash IS NULL;
