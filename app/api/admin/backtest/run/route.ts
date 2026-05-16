import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createBacktestRun } from "@/app/services/backtest/run-backtest.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ days: z.number().int().min(1).max(60) }).strict();

/**
 * Create a new backtest run. Returns the run row; caller polls /step
 * to advance through days one at a time.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const [instance] = await db.select().from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  const run = await createBacktestRun(instance, parsed.data.days);
  return NextResponse.json({ runId: run.id, days: run.days, startDate: run.startDate, endDate: run.endDate });
}
