import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { trades } from "./trades";

/**
 * Per-trade learning record. Created after a trade settles.
 * - outcome: 'win' | 'loss' | 'breakeven'
 * - reviewerAccuracy: { hermes: { verdict, justification }, athena: ..., cassandra: ... }
 *   where verdict is 'correct' | 'wrong' | 'unclear' (LIGHT LLM-tagged)
 * - lessons: short plain-English patterns extracted by LLM for future cycles
 */
export const memoryEntries = pgTable("memory_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }).unique(),
  outcome: text("outcome").notNull(),
  pnlPct: numeric("pnl_pct"),
  reviewerAccuracy: jsonb("reviewer_accuracy"),
  lessons: text("lessons").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Per-user, per-reviewer cumulative track record. DISPLAY-ONLY on the user's
 * dashboard + opt-in public /solon/{username} page. Does NOT influence the
 * synthesis writer or critic — that would re-introduce hardcoded weighting.
 */
export const reviewerTrackRecords = pgTable(
  "reviewer_track_records",
  {
    userId: uuid("user_id").notNull(),
    reviewerId: text("reviewer_id").notNull(), // 'hermes' | 'athena' | 'cassandra'
    tradesEvaluated: integer("trades_evaluated").notNull().default(0),
    correctCalls: integer("correct_calls").notNull().default(0),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.reviewerId] }),
  }),
);

export const memoryEntryRelations = relations(memoryEntries, ({ one }) => ({
  trade: one(trades, {
    fields: [memoryEntries.tradeId],
    references: [trades.id],
  }),
}));

export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type NewMemoryEntry = typeof memoryEntries.$inferInsert;
export type ReviewerTrackRecord = typeof reviewerTrackRecords.$inferSelect;
export type NewReviewerTrackRecord = typeof reviewerTrackRecords.$inferInsert;
