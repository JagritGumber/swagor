import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { simulateTradesForBacktest } from "@/app/services/backtest/simulate-trades.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  entryConfidence: z.number().min(0).max(1).optional(),
  holdDays: z.number().int().min(1).max(30).optional(),
  sizeUsd: z.number().min(1).max(100_000).optional(),
}).strict();

/**
 * Run the trade simulator over a completed backtest. Idempotent:
 * existing backtest_trades rows for the run are wiped and rebuilt so
 * the admin can sweep entry-confidence / hold-days / size on the same
 * LLM-generated analyses without re-running the swarm.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await context.params;
  try {
    const result = await simulateTradesForBacktest(id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/backtest/simulate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
