import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Watcher tick. One row per cheap-model decision about whether the market state
 * warrants escalating to the full panel. The watcher is an agent, not a
 * heuristic. It owns its own cadence: `nextCheckSeconds` is whatever the agent
 * chose this tick (clamped [30, 600] by the service).
 *
 * ~99% of ticks are `verdict: "hold"`. Only `escalate` triggers
 * orchestrator.runCycle and lands a row in rebalance_cycles.
 */
export const monitorTicks = pgTable("monitor_ticks", {
  id: uuid("id").primaryKey().defaultRandom(),
  selboInstanceId: uuid("selbo_instance_id").notNull(),
  verdict: text("verdict").notNull(), // 'hold' | 'escalate'
  rationale: text("rationale").notNull(),
  nextCheckSeconds: integer("next_check_seconds").notNull(),
  watching: jsonb("watching").$type<string[]>().notNull(),
  context: jsonb("context").notNull(), // prices, news count, last-tick info snapshot
  // Arc anchor for watcher verdicts of `execute` and `risk_emergency` (M5).
  // arcAnchorTx is Circle's internal id; arcOnchainTxHash is the mined Arc tx
  // hash, backfilled by pollPendingAnchors once Circle reports state=COMPLETE.
  // `hold` verdicts are not anchored (too noisy).
  arcAnchorTx: text("arc_anchor_tx"),
  arcOnchainTxHash: text("arc_onchain_tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MonitorTick = typeof monitorTicks.$inferSelect;
export type NewMonitorTick = typeof monitorTicks.$inferInsert;
