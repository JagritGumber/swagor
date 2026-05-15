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
 * Per-trade learning record. Inserted when a trade closes. The orchestrator
 * and watcher read recent lessons for the same user as context for future
 * cycles -- this is the in-context learning loop the landing page promises.
 *
 *  - outcome: 'win' | 'loss' | 'breakeven'
 *  - pnlPct: realized return as percent (null when entry price was missing)
 *  - lessons: 1-3 plain-English patterns extracted by a LIGHT LLM
 *
 * userId is text because Better Auth issues nanoid-format IDs that don't
 * fit uuid columns.
 */
export const memoryEntries = pgTable("memory_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }).unique(),
  outcome: text("outcome").notNull(),
  pnlPct: numeric("pnl_pct"),
  reviewerAccuracy: jsonb("reviewer_accuracy"),
  lessons: text("lessons").array(),
  // User feedback for in-context-learning correction. Null = no feedback.
  // 'bad' or deleted -> filtered from future agent context reads. See
  // memory `decision-transparency-legal-shield` and the M8 spec in the
  // current phase plan.
  userFeedback: text("user_feedback", { enum: ["good", "bad"] }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Per-user, per-reviewer cumulative track record. DISPLAY-ONLY on the user's
 * dashboard + opt-in public /selbo/{username} page. Does NOT influence the
 * synthesis writer or critic -- that would re-introduce hardcoded weighting.
 */
export const reviewerTrackRecords = pgTable(
  "reviewer_track_records",
  {
    userId: text("user_id").notNull(),
    reviewerId: text("reviewer_id").notNull(),
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
