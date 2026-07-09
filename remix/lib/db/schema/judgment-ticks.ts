import { pgTable, uuid, text, real, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { selboInstances } from "./selbo-instances";

export const judgmentTicks = pgTable("judgment_ticks", {
  id: uuid("id").primaryKey().defaultRandom(),
  selboInstanceId: uuid("selbo_instance_id")
    .notNull()
    .references(() => selboInstances.id, { onDelete: "cascade" }),
  asset: text("asset").notNull(),
  version: text("version").notNull(),
  side: text("side"),
  confidence: real("confidence"),
  reason: text("reason"),
  entryPrice: text("entry_price"),
  stopPrice: text("stop_price"),
  targetPrice: text("target_price"),
  invalidation: text("invalidation"),
  allJudgments: jsonb("all_judgments"),
  metricsSnapshot: jsonb("metrics_snapshot"),
  previousJudgmentId: uuid("previous_judgment_id")
    .references((): AnyPgColumn => judgmentTicks.id, { onDelete: "set null" }),
  tradeId: uuid("trade_id"),
  adminJudgment: boolean("admin_judgment").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type JudgmentTick = typeof judgmentTicks.$inferSelect;
export type NewJudgmentTick = typeof judgmentTicks.$inferInsert;
