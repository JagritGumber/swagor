import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Monitor tick — the cheap first stage of the two-stage cycle.
 * One light LLM call decides whether a trade signal is worth firing the
 * full pipeline. ~95% of ticks exit with hasSignal=false; only the rest
 * trigger downstream trade_proposals + reviewers + critic + executor.
 *
 * Fired by cron-job.org every 15 min (active hours) / 60 min (off-hours)
 * per active user. The orchestrator endpoint reads userId from the cron
 * payload, gathers context, runs the monitor LLM, and inserts a row here.
 */
export const monitorTicks = pgTable("monitor_ticks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  hasSignal: boolean("has_signal").notNull(),
  signalType: text("signal_type"), // 'momentum' | 'depeg_risk' | 'yield_window' | 'news_driven' | 'idle_park' | null
  confidence: numeric("confidence"),
  reasoning: text("reasoning"),
  context: jsonb("context").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MonitorTick = typeof monitorTicks.$inferSelect;
export type NewMonitorTick = typeof monitorTicks.$inferInsert;
