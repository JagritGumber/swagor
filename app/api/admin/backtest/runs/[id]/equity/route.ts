import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades } from "@/lib/db/schema";
import { STARTING_EQUITY_USD } from "@/app/services/backtest/simulate-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

type Snapshot = { ts: string; equityUsd: number; withdrawableUsd: number; openPositions: number };

/**
 * GET /api/admin/backtest/runs/[id]/equity
 *
 * Derived equity series for a backtest. Mirrors the shape of
 * /api/equity/recent so the EquityCurve component consumes it
 * unmodified via its `endpoint` prop. Day end equity =
 * STARTING_EQUITY_USD plus the sum of pnl from trades closed on or
 * before that day. When no trades exist, emits a flat series so the
 * chart still renders.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid run id" }, { status: 400 });

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trades = await db.select({ exitDate: backtestTrades.exitDate, pnlUsd: backtestTrades.pnlUsd })
    .from(backtestTrades)
    .where(and(eq(backtestTrades.backtestRunId, id), isNotNull(backtestTrades.exitDate)))
    .orderBy(asc(backtestTrades.exitDate));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const snapshots: Snapshot[] = [];
  let cumPnl = 0;
  let tIdx = 0;

  for (let i = 0; i < run.days; i++) {
    const dayEndMs = startMs + (i + 1) * 86_400_000 - 1;
    while (tIdx < trades.length) {
      const t = trades[tIdx];
      if (!t.exitDate || t.exitDate.getTime() > dayEndMs) break;
      cumPnl += Number(t.pnlUsd ?? 0);
      tIdx++;
    }
    const equity = STARTING_EQUITY_USD + cumPnl;
    snapshots.push({
      ts: new Date(dayEndMs).toISOString(),
      equityUsd: equity,
      withdrawableUsd: equity,
      openPositions: 0,
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
