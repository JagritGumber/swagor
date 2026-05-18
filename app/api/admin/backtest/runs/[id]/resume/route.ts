import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: resume a failed backtest. Flips status back to "running" and
 * clears errorMessage + completedAt so the row looks live again. The
 * client picks up polling /step from where it left off; stepBacktestRun
 * is already idempotent (picks the next day with no daily_plans row),
 * so partial progress is preserved.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.status === "completed") {
    return NextResponse.json(
      { error: "Completed backtests cannot be resumed" },
      { status: 409 },
    );
  }
  if (run.status === "running") {
    return NextResponse.json({ run });
  }

  const [updated] = await db.update(backtestRuns).set({
    status: "running",
    errorMessage: null,
    completedAt: null,
  }).where(eq(backtestRuns.id, id)).returning();

  return NextResponse.json({ run: updated });
}
