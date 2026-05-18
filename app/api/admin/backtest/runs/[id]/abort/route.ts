import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const IdSchema = z.string().uuid();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin: abort a stuck "running" backtest. Marks status=failed and
 * stamps completedAt so the row stops looking active. stepBacktestRun
 * guards on status=running, so any still-alive original-tab poller
 * will short-circuit on its next /step call.
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
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: "Invalid run id" }, { status: 400 });

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, id)).limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.status !== "running") {
    return NextResponse.json(
      { error: `Only running backtests can be aborted; current status=${run.status}` },
      { status: 409 },
    );
  }

  const [updated] = await db.update(backtestRuns).set({
    status: "failed",
    errorMessage: "manually aborted",
    completedAt: new Date(),
  }).where(eq(backtestRuns.id, id)).returning();

  return NextResponse.json({ run: updated });
}
