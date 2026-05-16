import { pgTable, uuid, text, integer, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { portfolios } from "./portfolios";

export const rebalanceCycles = pgTable("rebalance_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "cascade" }),
  // Per-instance scoping for daily-plan + rate-limit queries. App-level FK
  // to selbo_instances; nullable so legacy rows (pre-migration) remain valid.
  selboInstanceId: uuid("selbo_instance_id"),
  // 'daily' = scheduled cron run; 'watcher' = mid-day regime-shift trigger.
  // Nullable for legacy rows (back-fill to 'watcher' if you need a value).
  triggeredBy: text("triggered_by", { enum: ["daily", "watcher"] }),
  status: text("status").notNull(), // 'running' | 'approved' | 'rejected' | 'executed' | 'failed'
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cycleState: jsonb("cycle_state"),
  ipfsCid: text("ipfs_cid"),
  arcTxHash: text("arc_tx_hash"),
}, (table) => ({
  triggeredByCheck: check(
    "rebalance_cycles_triggered_by_check",
    sql`${table.triggeredBy} IS NULL OR ${table.triggeredBy} IN ('daily', 'watcher')`,
  ),
}));

export const agentReasoning = pgTable("agent_reasoning", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").references(() => rebalanceCycles.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  model: text("model").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const marketSnapshots = pgTable("market_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow().notNull(),
  protocols: jsonb("protocols").notNull(),
  prices: jsonb("prices").notNull(),
  newsItems: jsonb("news_items"),
});

export const cycleRelations = relations(rebalanceCycles, ({ many, one }) => ({
  reasoning: many(agentReasoning),
  portfolio: one(portfolios, {
    fields: [rebalanceCycles.portfolioId],
    references: [portfolios.id],
  }),
}));

export const reasoningRelations = relations(agentReasoning, ({ one }) => ({
  cycle: one(rebalanceCycles, {
    fields: [agentReasoning.cycleId],
    references: [rebalanceCycles.id],
  }),
}));

export type RebalanceCycle = typeof rebalanceCycles.$inferSelect;
export type AgentReasoning = typeof agentReasoning.$inferSelect;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
