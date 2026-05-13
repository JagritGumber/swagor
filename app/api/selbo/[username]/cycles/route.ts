import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { solonInstances, portfolios, rebalanceCycles } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

/**
 * Public recent-decisions feed for a published Selbo. Returns the last N
 * cycles for the instance's portfolio, no auth, only when publicProfile
 * is true. Cycle bodies are NOT exposed here; this is the index list
 * only. Drill-down into a specific cycle is a separate public route the
 * UI does not need yet.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "10"), 1), 50);

  const [instance] = await db
    .select()
    .from(solonInstances)
    .where(and(eq(solonInstances.username, username), eq(solonInstances.publicProfile, true)))
    .limit(1);

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.walletAddress, instance.circleWalletAddress))
    .limit(1);

  if (!portfolio) {
    return NextResponse.json(
      { cycles: [] },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
    );
  }

  const cycles = await db
    .select({
      id: rebalanceCycles.id,
      status: rebalanceCycles.status,
      startedAt: rebalanceCycles.startedAt,
      completedAt: rebalanceCycles.completedAt,
    })
    .from(rebalanceCycles)
    .where(eq(rebalanceCycles.portfolioId, portfolio.id))
    .orderBy(desc(rebalanceCycles.startedAt))
    .limit(limit);

  // Cycles only land on rare `deliberate` escalations, so the CDN can
  // hold this list a little longer than the watcher feed.
  return NextResponse.json(
    { cycles },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
