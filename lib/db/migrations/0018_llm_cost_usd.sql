-- Real per-call cost in USD, computed at log time using the per-model
-- rate table in lib/llm/rates.ts. Replaces the previous global
-- LLM_COST_PER_1K_TOKENS_USD flat-rate guess. Older rows (pre-migration)
-- stay NULL; downstream queries (cost-cap, cycle-cost) treat NULL as
-- "not counted" so the gap doesn't poison sums.

ALTER TABLE llm_calls
  ADD COLUMN IF NOT EXISTS cost_usd numeric(20, 8);
--> statement-breakpoint
-- Per-day aggregation hot path: cost-cap queries SUM(cost_usd) per
-- selbo_instance_id since midnight. Partial index keeps the scan O(today)
-- not O(all-time).
CREATE INDEX IF NOT EXISTS llm_calls_daily_cost_idx
  ON llm_calls(selbo_instance_id, created_at)
  WHERE cost_usd IS NOT NULL;
