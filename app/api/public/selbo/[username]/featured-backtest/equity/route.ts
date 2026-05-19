import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { STARTING_EQUITY_USD } from "@/app/services/backtest/simulate-helpers";
import { getFeaturedBacktest } from "@/app/services/featured-backtest.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Snapshot = { ts: string; equityUsd: number; withdrawableUsd: number; openPositions: number };

/**
 * GET /api/public/selbo/[username]/featured-backtest/equity
 *
 * Public mirror of the admin equity endpoint, scoped to the latest
 * completed backtest for a public Selbo profile. Three-way guard:
 * username matches, publicProfile=true, backtest belongs to that
 * instance. Returns the same shape as /api/equity/recent so EquityCurve
 * consumes it via its `endpoint` prop unchanged.
 */
export async function GET(_req: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;

  const [instance] = await db.select({ id: selboInstances.id })
    .from(selboInstances)
    .where(and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)))
    .limit(1);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const featured = await getFeaturedBacktest(instance.id);
  if (!featured) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { run, trades } = featured;
  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const sorted = [...trades].filter((t) => t.exitDate !== null).sort((a, b) => (a.exitDate!.getTime() - b.exitDate!.getTime()));
  const snapshots: Snapshot[] = [];
  let cumPnl = 0;
  let tIdx = 0;

  for (let i = 0; i < run.days; i++) {
    const dayEndMs = startMs + (i + 1) * 86_400_000 - 1;
    while (tIdx < sorted.length) {
      const t = sorted[tIdx];
      if (!t.exitDate || t.exitDate.getTime() > dayEndMs) break;
      cumPnl += Number(t.pnlUsd ?? 0);
      tIdx++;
    }
    const equity = STARTING_EQUITY_USD + cumPnl;
    snapshots.push({
      ts: new Date(dayEndMs).toISOString(),
      equityUsd: equity, withdrawableUsd: equity, openPositions: 0,
    });
  }

  let high = STARTING_EQUITY_USD;
  let low = STARTING_EQUITY_USD;
  for (const s of snapshots) {
    if (s.equityUsd > high) high = s.equityUsd;
    if (s.equityUsd < low) low = s.equityUsd;
  }

  return NextResponse.json({ snapshots, lifetime: { start: STARTING_EQUITY_USD, high, low } });
}
