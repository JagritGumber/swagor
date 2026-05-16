import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { simulateTradesForBacktest } from "@/app/services/backtest/simulate-trades.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Run the trade simulator over a completed backtest. Idempotent:
 * existing backtest_trades rows for the run are wiped and rebuilt so
 * the admin can re-simulate after tweaking the simulator constants.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  try {
    const result = await simulateTradesForBacktest(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/backtest/simulate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
