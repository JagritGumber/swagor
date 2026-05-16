import { pgTable, uuid, text, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * One row per backtest invocation. Children (daily_plans +
 * rebalance_cycles produced by the backtest) carry the same
 * backtest_run_id so the dev panel can list them together without
 * polluting the live Brain page.
 */
export const backtestRuns = pgTable("backtest_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  selboInstanceId: uuid("selbo_instance_id").notNull(),
  startDate: text("start_date").notNull(),   // YYYY-MM-DD UTC of earliest day
  endDate: text("end_date").notNull(),       // YYYY-MM-DD UTC of latest day
  days: integer("days").notNull(),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  cyclesRequested: integer("cycles_requested").notNull(),
  cyclesCompleted: integer("cycles_completed").notNull().default(0),
  cyclesFailed: integer("cycles_failed").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  statusCheck: check(
    "backtest_runs_status_check",
    sql`${table.status} IN ('running', 'completed', 'failed')`,
  ),
}));

export type BacktestRun = typeof backtestRuns.$inferSelect;
export type NewBacktestRun = typeof backtestRuns.$inferInsert;
