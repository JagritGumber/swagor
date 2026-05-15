import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { trades, monitorTicks, selboInstances } from "@/lib/db/schema";
import { tradeProposals } from "@/lib/db/schema/trade-proposals";
import { rebalanceCycles } from "@/lib/db/schema/cycles";
import { and, eq, lt, desc, gte, lte } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trades/{id}/reasoning
 *
 * Returns a best-effort reasoning bundle for a trade:
 *   - the trade row itself
 *   - the watcher tick that most likely triggered the open
 *     (latest monitor_tick before openedAt for the same instance)
 *   - the watcher tick around close time, if any
 *   - the trade proposal that authored the open, if proposalId is set
 *   - the rebalance cycle the proposal came from, if any
 *
 * The Fast Trader path does not currently persist its own rationale per
 * trade; the linked watcher tick is the closest thing we have. Panel
 * (deliberate) trades carry proposalId -> proposal.reasoningTrace +
 * the parent cycle's aggregated state.
 */
const TICK_WINDOW_MS = 5 * 60 * 1000; // 5 min either side

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [trade] = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trade.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [instance] = await db
    .select({ id: selboInstances.id })
    .from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id))
    .limit(1);

  let openTick = null;
  if (trade.openedAt && instance) {
    const openLowerBound = new Date(trade.openedAt.getTime() - TICK_WINDOW_MS);
    const [t] = await db
      .select()
      .from(monitorTicks)
      .where(
        and(
          eq(monitorTicks.selboInstanceId, instance.id),
          gte(monitorTicks.createdAt, openLowerBound),
          lte(monitorTicks.createdAt, trade.openedAt),
        ),
      )
      .orderBy(desc(monitorTicks.createdAt))
      .limit(1);
    openTick = t ?? null;
  }

  let closeTick = null;
  if (trade.closedAt && instance) {
    const closeLower = new Date(trade.closedAt.getTime() - TICK_WINDOW_MS);
    const closeUpper = new Date(trade.closedAt.getTime() + TICK_WINDOW_MS);
    const [t] = await db
      .select()
      .from(monitorTicks)
      .where(
        and(
          eq(monitorTicks.selboInstanceId, instance.id),
          gte(monitorTicks.createdAt, closeLower),
          lte(monitorTicks.createdAt, closeUpper),
        ),
      )
      .orderBy(desc(monitorTicks.createdAt))
      .limit(1);
    closeTick = t ?? null;
  }

  let proposal = null;
  let cycle = null;
  if (trade.proposalId) {
    const [p] = await db
      .select()
      .from(tradeProposals)
      .where(eq(tradeProposals.id, trade.proposalId))
      .limit(1);
    proposal = p ?? null;

    if (p?.monitorTickId) {
      const [tickFromProposal] = await db
        .select()
        .from(monitorTicks)
        .where(eq(monitorTicks.id, p.monitorTickId))
        .limit(1);
      if (tickFromProposal) openTick = tickFromProposal;
    }
  }

  // Best-effort: if the trade has no explicit proposalId but a cycle
  // produced trades around the same window, surface that too. Skip for now
  // because cycles aren't linked to trades; revisit if rebalance_cycles
  // gains a foreign key. Left null on the response.
  void lt; void cycle;

  return NextResponse.json({
    trade,
    openTick,
    closeTick,
    proposal,
    cycle: null,
  });
}
