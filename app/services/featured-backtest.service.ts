import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans, type BacktestRun, type BacktestTrade, type DailyPlan } from "@/lib/db/schema";

export type FeaturedBacktest = {
  run: BacktestRun;
  trades: BacktestTrade[];
  plans: DailyPlan[];
};

/**
 * Resolve the most recent completed backtest for a Selbo instance, plus
 * its trades and plans. Used by the public profile to surface 30-day
 * results in place of empty live data, and by the public equity endpoint
 * to derive the day-by-day curve from the trades' PnL series. Returns
 * null when the instance has never finished a backtest.
 */
export async function getFeaturedBacktest(instanceId: string): Promise<FeaturedBacktest | null> {
  const [run] = await db.select().from(backtestRuns)
    .where(and(eq(backtestRuns.selboInstanceId, instanceId), eq(backtestRuns.status, "completed")))
    .orderBy(desc(backtestRuns.createdAt))
    .limit(1);
  if (!run) return null;

  const [trades, plans] = await Promise.all([
    db.select().from(backtestTrades).where(eq(backtestTrades.backtestRunId, run.id)).orderBy(asc(backtestTrades.entryDate)),
    db.select().from(dailyPlans).where(eq(dailyPlans.backtestRunId, run.id)).orderBy(asc(dailyPlans.generatedAt)),
  ]);

  return { run, trades, plans };
}
