import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, dailyPlans, type BacktestRun, type SelboInstance } from "@/lib/db/schema";
import { runBacktestDay } from "./run-backtest-day.service";

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function createBacktestRun(instance: SelboInstance, days: number): Promise<BacktestRun> {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const [row] = await db.insert(backtestRuns).values({
    userId: instance.userId,
    selboInstanceId: instance.id,
    startDate: utcDayString(start),
    endDate: utcDayString(end),
    days,
    status: "running",
    cyclesRequested: days,
  }).returning();
  if (!row) throw new Error("backtest_runs insert returned no row");
  return row;
}

/**
 * Run the next pending day in a backtest. Idempotent per (runId, day):
 * picks the earliest date in [startDate, endDate] without a daily_plans
 * row yet for this runId, then executes one cycle for that day. Returns
 * `{done: true}` when every day has run; caller polls this until done
 * so a 30-day backtest stays under each request's maxDuration.
 */
export async function stepBacktestRun(
  runId: string, instance: SelboInstance,
): Promise<{ done: boolean; completed: number; total: number; reason?: string }> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);

  const existing = await db.select({ ts: dailyPlans.generatedAt })
    .from(dailyPlans).where(eq(dailyPlans.backtestRunId, runId));
  const doneDays = new Set(existing.map((r) => utcDayString(r.ts)));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  let nextDay: Date | null = null;
  for (let i = 0; i < run.days; i++) {
    const candidate = new Date(startMs + i * 86_400_000);
    if (!doneDays.has(utcDayString(candidate))) { nextDay = candidate; break; }
  }
  const completed = doneDays.size;
  if (!nextDay) {
    await db.update(backtestRuns).set({
      status: "completed", cyclesCompleted: completed, completedAt: new Date(),
    }).where(eq(backtestRuns.id, runId));
    return { done: true, completed, total: run.days };
  }

  // Anchor asOf at the END of the UTC day so the day's candles are mature.
  const asOf = new Date(nextDay.getTime() + 86_400_000 - 5 * 60_000);
  try {
    await runBacktestDay(instance, asOf, runId);
    await db.update(backtestRuns).set({
      cyclesCompleted: sql`${backtestRuns.cyclesCompleted} + 1`,
    }).where(eq(backtestRuns.id, runId));
    return { done: false, completed: completed + 1, total: run.days };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(backtestRuns).set({
      cyclesFailed: sql`${backtestRuns.cyclesFailed} + 1`, errorMessage: msg,
    }).where(eq(backtestRuns.id, runId));
    return { done: false, completed, total: run.days, reason: msg };
  }
}
