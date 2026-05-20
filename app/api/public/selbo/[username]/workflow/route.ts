import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { dailyPlans, llmCalls, rebalanceCycles, selboInstances } from "@/lib/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

const CACHE = "public, max-age=15, s-maxage=30, stale-while-revalidate=60";

/**
 * Public workflow feed for a published Selbo: the latest live (non-backtest)
 * cycle plus its llm_calls and the matching daily-plan anchor fields, shaped
 * so the client can call deriveStages directly and render the pipeline
 * (context -> swarm -> aggregate -> compile -> anchor). publicProfile-gated
 * like /recent. Exposes structure and timing, never the reasoning corpus.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { username } = await params;

  const [instance] = await db
    .select({ id: selboInstances.id })
    .from(selboInstances)
    .where(and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)))
    .limit(1);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [cycle] = await db
    .select({
      id: rebalanceCycles.id,
      status: rebalanceCycles.status,
      startedAt: rebalanceCycles.startedAt,
      completedAt: rebalanceCycles.completedAt,
      errorMessage: rebalanceCycles.errorMessage,
    })
    .from(rebalanceCycles)
    .where(and(eq(rebalanceCycles.selboInstanceId, instance.id), isNull(rebalanceCycles.backtestRunId)))
    .orderBy(desc(rebalanceCycles.startedAt))
    .limit(1);

  if (!cycle) {
    return NextResponse.json({ cycle: null, calls: [], plan: null }, { headers: { "Cache-Control": CACHE } });
  }

  const [calls, plans] = await Promise.all([
    db
      .select({ id: llmCalls.id, agentName: llmCalls.agentName, durationMs: llmCalls.durationMs, createdAt: llmCalls.createdAt })
      .from(llmCalls)
      .where(eq(llmCalls.cycleId, cycle.id))
      .orderBy(asc(llmCalls.createdAt)),
    db
      .select({ generatedAt: dailyPlans.generatedAt, arcAnchorTx: dailyPlans.arcAnchorTx, arcOnchainTxHash: dailyPlans.arcOnchainTxHash })
      .from(dailyPlans)
      .where(eq(dailyPlans.cycleId, cycle.id))
      .orderBy(desc(dailyPlans.generatedAt))
      .limit(1),
  ]);

  return NextResponse.json(
    {
      cycle: {
        id: cycle.id,
        status: cycle.status,
        createdAt: cycle.startedAt,
        completedAt: cycle.completedAt,
        errorMessage: cycle.errorMessage,
      },
      calls,
      plan: plans[0] ?? null,
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
