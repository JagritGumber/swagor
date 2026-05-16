import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stepBacktestRun } from "@/app/services/backtest/run-backtest.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({ runId: z.string().uuid() }).strict();

/**
 * Advance a backtest by one day. Caller polls this until {done: true}.
 * Each call runs at most one swarm cycle (~16-20s) which stays well
 * under maxDuration.
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

  try {
    const result = await stepBacktestRun(parsed.data.runId, instance);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
