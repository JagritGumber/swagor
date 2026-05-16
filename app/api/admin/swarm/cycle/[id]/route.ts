import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentReasoning, aggregations, llmCalls, rebalanceCycles, swarmRounds } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: full trace of a single cycle. Returns the cycle row, all swarm
 * round rows (one per persona), the aggregation row, every agent_reasoning
 * row (critic, plan-compiler, etc.), and every llm_calls row keyed to the
 * cycle. The dev panel renders this as a tree.
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

  const [rounds, aggs, reasoning, calls] = await Promise.all([
    db.select().from(swarmRounds).where(eq(swarmRounds.cycleId, id)).orderBy(asc(swarmRounds.createdAt)),
    db.select().from(aggregations).where(eq(aggregations.cycleId, id)).limit(1),
    db.select().from(agentReasoning).where(eq(agentReasoning.cycleId, id)).orderBy(asc(agentReasoning.createdAt)),
    db.select().from(llmCalls).where(eq(llmCalls.cycleId, id)).orderBy(asc(llmCalls.createdAt)),
  ]);

  return NextResponse.json({
    cycle,
    swarmRounds: rounds,
    aggregation: aggs[0] ?? null,
    agentReasoning: reasoning,
    llmCalls: calls,
  });
}
