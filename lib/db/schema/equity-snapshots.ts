import { pgTable, uuid, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-tick snapshot of a Selbo instance's equity. Written by the watcher
 * after every tick; powers the dashboard equity curve and the 24h balance
 * delta on the balance card. Append-only audit data; failure swallowed.
 *
 * `equityUsd` and `withdrawableUsd` come from the Hyperliquid clearinghouse
 * read. On clearing fetch failure we fall back to `simulatedBalanceUsd`
 * from the instance so the curve still moves.
 */
export const equitySnapshots = pgTable("equity_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  selboInstanceId: uuid("selbo_instance_id").notNull(),
  equityUsd: numeric("equity_usd", { precision: 20, scale: 6 }).notNull(),
  withdrawableUsd: numeric("withdrawable_usd", { precision: 20, scale: 6 }).notNull(),
  openPositionsCount: integer("open_positions_count").notNull().default(0),
  takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EquitySnapshot = typeof equitySnapshots.$inferSelect;
export type NewEquitySnapshot = typeof equitySnapshots.$inferInsert;
