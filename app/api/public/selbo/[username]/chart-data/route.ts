import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { buildChartData, buildBacktestChartData, VALID_INTERVALS } from "@/app/services/chart-data.service";
import { getFeaturedBacktest } from "@/app/services/featured-backtest.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public chart data (candles + the agent's entry/exit markers) for a
 * flagship Selbo profile. Gated on publicProfile=true so a private
 * user's trades never leak. Same shape as /api/chart-data.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get("asset") ?? "").toUpperCase();
  const interval = searchParams.get("interval") ?? "5m";
  const lookbackMs = Number(searchParams.get("lookbackMs") ?? 86_400_000);

  if (!asset) return NextResponse.json({ error: "asset required" }, { status: 400 });
  if (!VALID_INTERVALS.has(interval)) return NextResponse.json({ error: "bad interval" }, { status: 400 });
  if (!Number.isFinite(lookbackMs) || lookbackMs <= 0) {
    return NextResponse.json({ error: "bad lookbackMs" }, { status: 400 });
  }

  const [instance] = await db
    .select({ id: selboInstances.id, userId: selboInstances.userId })
    .from(selboInstances)
    .where(and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)))
    .limit(1);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prefer the featured backtest's trades so the chart matches the Trades tab.
  // Fall back to live trades only when there is no featured backtest.
  const featured = await getFeaturedBacktest(instance.id);
  if (featured) {
    return NextResponse.json(await buildBacktestChartData({ asset, interval, lookbackMs, trades: featured.trades }));
  }
  return NextResponse.json(await buildChartData({ userId: instance.userId, asset, interval, lookbackMs }));
}
