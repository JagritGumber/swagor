import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns, dailyPlans } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: detail view for one backtest run. Returns the run row + every
 * daily_plans row produced by it, ordered chronologically so the UI
 * can render a timeline.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plans = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.backtestRunId, id))
    .orderBy(asc(dailyPlans.generatedAt));

  return NextResponse.json({ run, plans });
}
