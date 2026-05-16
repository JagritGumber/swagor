import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentReasoning, aggregations, llmCalls, rebalanceCycles, selboInstances, swarmRounds } from "@/lib/db/schema";
import { computeCycleCost, computeCycleLatency } from "@/lib/utils/cycle-cost";
import { findCycleWarnings } from "@/lib/utils/cycle-checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: full trace of a single cycle + a derived summary header
 * (cost in USD, wall-clock + slowest agent latency, hallucination /
 * bound check warnings). Lets the dev panel render the audit triage
 * without the client knowing about token rates or watchlist rules.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  const [cycle] = await db.select().from(rebalanceCycles).where(eq(rebalanceCycles.id, id)).limit(1);
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rounds, aggs, reasoning, calls, instance] = await Promise.all([
    db.select().from(swarmRounds).where(eq(swarmRounds.cycleId, id)).orderBy(asc(swarmRounds.createdAt)),
    db.select().from(aggregations).where(eq(aggregations.cycleId, id)).limit(1),
    db.select().from(agentReasoning).where(eq(agentReasoning.cycleId, id)).orderBy(asc(agentReasoning.createdAt)),
    db.select().from(llmCalls).where(eq(llmCalls.cycleId, id)).orderBy(asc(llmCalls.createdAt)),
    cycle.selboInstanceId
      ? db.select({ currentlyWatching: selboInstances.currentlyWatching })
          .from(selboInstances).where(eq(selboInstances.id, cycle.selboInstanceId)).limit(1)
      : Promise.resolve([]),
  ]);

  const aggregation = aggs[0] ?? null;
  const watchlist = instance[0]?.currentlyWatching ?? [];
  const cost = computeCycleCost(calls);
  const latency = computeCycleLatency(cycle, calls);
  const warnings = findCycleWarnings({ watchlist, aggregation, agentReasoning: reasoning });

  return NextResponse.json({
    cycle, swarmRounds: rounds, aggregation,
    agentReasoning: reasoning, llmCalls: calls,
    summary: { cost, latency, warnings, watchlist },
  });
}
