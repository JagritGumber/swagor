import { pgTable, uuid, text, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { selboInstances } from "./selbo-instances";

/**
 * Judgment engine output per tick. One row per judgment evaluation.
 * Stores the side, confidence, reason, and full metrics snapshot so the
 * landing page and dashboards can query historical judgments without
 * re-running the engine.
 */
export const judgmentTicks = pgTable("judgment_ticks", {
  id: uuid("id").primaryKey().defaultRandom(),
  selboInstanceId: uuid("selbo_instance_id")
    .references(() => selboInstances.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  version: text("version").notNull(),
  side: text("side"), // "long" | "short" | null (no-trade)
  confidence: real("confidence"),
  reason: text("reason"),
  entryPrice: text("entry_price"),
  stopPrice: text("stop_price"),
  targetPrice: text("target_price"),
  invalidation: text("invalidation"),
  previousJudgmentId: uuid("previous_judgment_id"),
  tradeId: uuid("trade_id"),
  adminJudgment: boolean("admin_judgment").notNull().default(false),
  allJudgments: jsonb("all_judgments"),
  metricsSnapshot: jsonb("metrics_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type JudgmentTick = typeof judgmentTicks.$inferSelect;
export type NewJudgmentTick = typeof judgmentTicks.$inferInsert;

export const judgmentTickRelations = relations(judgmentTicks, ({ one }) => ({
  selboInstance: one(selboInstances, {
    fields: [judgmentTicks.selboInstanceId],
    references: [selboInstances.id],
  }),
  previousJudgment: one(judgmentTicks, {
    fields: [judgmentTicks.previousJudgmentId],
    references: [judgmentTicks.id],
    relationName: "judgmentChain",
  }),
}));
