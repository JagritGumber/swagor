import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans, rebalanceCycles } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: detail view for one backtest run. Returns the run row + every
 * daily_plans row + simulated trades + derived summary stats (total
 * pnl, win rate, best/worst). The UI uses this single payload to
 * render the timeline AND the PnL header.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [plans, trades, cycles] = await Promise.all([
    db.select().from(dailyPlans).where(eq(dailyPlans.backtestRunId, id)).orderBy(asc(dailyPlans.generatedAt)),
    db.select().from(backtestTrades).where(eq(backtestTrades.backtestRunId, id)).orderBy(asc(backtestTrades.entryDate)),
    db.select({
      id: rebalanceCycles.id, asOf: rebalanceCycles.asOf, status: rebalanceCycles.status,
      createdAt: rebalanceCycles.startedAt, completedAt: rebalanceCycles.completedAt,
      errorMessage: rebalanceCycles.errorMessage,
    }).from(rebalanceCycles).where(eq(rebalanceCycles.backtestRunId, id)).orderBy(asc(rebalanceCycles.asOf)),
  ]);

  const summary = summarizeBacktestTrades(trades);

  return NextResponse.json({ run, plans, trades, summary, cycles });
}
