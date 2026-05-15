import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Multi-turn strategy chat. Each user-role row is a strategy revision
 * the user sent; the immediately following selbo-role row is the LIGHT
 * paraphrase reply. Effective strategy = latest role='user' message.
 *
 * `selboInstances.strategyText` is a denormalized cache for fast agent
 * reads (watcher / fast-trader). The chat handler keeps it in sync on
 * every user-message send.
 *
 * userId is text because Better Auth issues nanoid-format IDs.
 */
export const strategyRevisions = pgTable("strategy_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["user", "selbo"] }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StrategyRevision = typeof strategyRevisions.$inferSelect;
export type NewStrategyRevision = typeof strategyRevisions.$inferInsert;
