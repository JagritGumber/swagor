import { pgTable, uuid, text, numeric, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Simulated trades from a backtest run. One row per trade the bias
 * filter opened. Entry and exit prices come from daily candles
 * pre-fetched across the run window so the simulator doesn't hammer
 * Hyperliquid per-trade.
 *
 * Open trades exist transiently inside simulateTradesForBacktest; by
 * the time rows land in the table they are status='closed' with both
 * exit_price and pnl_usd populated. The status column is still here
 * to make future Phase C (rolling-window trades) easier to wire in.
 */
export const backtestTrades = pgTable("backtest_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  backtestRunId: uuid("backtest_run_id").notNull(),
  asset: text("asset").notNull(),
  side: text("side").notNull(),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
  entryPrice: numeric("entry_price", { precision: 30, scale: 12 }).notNull(),
  exitDate: timestamp("exit_date", { withTimezone: true }),
  exitPrice: numeric("exit_price", { precision: 30, scale: 12 }),
  sizeUsd: numeric("size_usd", { precision: 20, scale: 6 }).notNull(),
  pnlUsd: numeric("pnl_usd", { precision: 20, scale: 6 }),
  pnlPct: numeric("pnl_pct", { precision: 10, scale: 4 }),
  biasConfidence: numeric("bias_confidence", { precision: 4, scale: 3 }).notNull(),
  status: text("status").notNull(),
  exitReason: text("exit_reason"),
}, (table) => ({
  statusCheck: check("backtest_trades_status_check", sql`${table.status} IN ('open', 'closed')`),
  sideCheck: check("backtest_trades_side_check", sql`${table.side} IN ('long', 'short')`),
}));

export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type NewBacktestTrade = typeof backtestTrades.$inferInsert;
