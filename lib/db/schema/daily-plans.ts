import { pgTable, uuid, text, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * One row per scheduled daily-plan run (per UTC day per Selbo instance).
 * Watcher-triggered cycles do NOT write to this table; they only land in
 * `rebalance_cycles` with `triggered_by='watcher'`. Brain page reads the
 * latest row here; admin dev panel reads `rebalance_cycles` directly.
 *
 * `status` enforced via CHECK so a DB-level insert can't store 'meh'.
 * App-level foreign keys (uuid columns, no constraints) so a cycle or
 * instance row can be deleted without cascading -- audit data only.
 */
export const dailyPlans = pgTable("daily_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  selboInstanceId: uuid("selbo_instance_id").notNull(),
  cycleId: uuid("cycle_id").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status", { enum: ["pending", "complete", "failed"] }).notNull(),
  planMarkdown: text("plan_markdown"),
  planJson: jsonb("plan_json"),
  errorMessage: text("error_message"),
  // Backtest scoping. When set, this plan was produced by a historical
  // replay run; live Brain page queries filter `backtest_run_id IS NULL`.
  backtestRunId: uuid("backtest_run_id"),
  // Arc anchor pair. `arcAnchorTx` is Circle's internal id, returned when
  // anchorDailyAnalysis is queued; `arcOnchainTxHash` is backfilled by
  // pollPendingAnchors once Circle reports state=COMPLETE.
  arcAnchorTx: text("arc_anchor_tx"),
  arcOnchainTxHash: text("arc_onchain_tx_hash"),
}, (table) => ({
  statusCheck: check(
    "daily_plans_status_check",
    sql`${table.status} IN ('pending', 'complete', 'failed')`,
  ),
}));

export type DailyPlan = typeof dailyPlans.$inferSelect;
export type NewDailyPlan = typeof dailyPlans.$inferInsert;
