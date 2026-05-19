import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { llmCalls, rebalanceCycles } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

/**
 * GET /api/admin/backtest/runs/[id]/llm-calls
 *
 * Returns every LLM call linked to the backtest's cycles. Joined via
 * rebalance_cycles (where backtestRunId = id) so the response captures
 * persona swarm calls, the compiler, and any other call that wrote a
 * cycleId. Sorted by durationMs DESC, NULLS LAST — the slowest calls
 * sit at the top so stuck-cycle outliers are obvious.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!IdSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid run id" }, { status: 400 });

  const cycles = await db.select({ id: rebalanceCycles.id, asOf: rebalanceCycles.asOf })
    .from(rebalanceCycles).where(eq(rebalanceCycles.backtestRunId, id));
  if (cycles.length === 0) return NextResponse.json({ calls: [] });

  const cycleIds = cycles.map((c) => c.id);
  const calls = await db.select({
    id: llmCalls.id, cycleId: llmCalls.cycleId, agentName: llmCalls.agentName,
    model: llmCalls.model, promptTokens: llmCalls.promptTokens,
    completionTokens: llmCalls.completionTokens, costUsd: llmCalls.costUsd,
    durationMs: llmCalls.durationMs, createdAt: llmCalls.createdAt,
  }).from(llmCalls).where(and(inArray(llmCalls.cycleId, cycleIds))).orderBy(desc(llmCalls.createdAt));

  const asOfByCycle = new Map(cycles.map((c) => [c.id, c.asOf]));
  return NextResponse.json({
    calls: calls.map((c) => ({
      ...c,
      asOf: c.cycleId ? asOfByCycle.get(c.cycleId)?.toISOString() ?? null : null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
