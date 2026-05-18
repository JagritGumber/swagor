import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns } from "@/lib/db/schema";
import { simulateTradesForBacktest } from "./simulate-trades.service";

/**
 * Finalize a backtest after the last day's plan has landed. Runs the
 * trade simulator over every plan, then flips status to "completed".
 * If the simulator throws, status flips to "failed" with the error
 * prefixed by "sim:" so the run view surfaces what went wrong. The
 * simulator is idempotent (wipes existing backtest_trades for the run
 * before writing) so resume-after-failure is safe.
 */
export async function completeBacktestRun(
  runId: string,
  completed: number,
): Promise<{ reason?: string }> {
  try {
    await simulateTradesForBacktest(runId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(backtestRuns).set({
      status: "failed",
      errorMessage: `sim: ${msg}`,
      completedAt: new Date(),
    }).where(eq(backtestRuns.id, runId));
    return { reason: msg };
  }
  await db.update(backtestRuns).set({
    status: "completed",
    cyclesCompleted: completed,
    completedAt: new Date(),
    errorMessage: null,
  }).where(eq(backtestRuns.id, runId));
  return {};
}
