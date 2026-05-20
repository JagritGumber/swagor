import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runWatcherReplay } from "@/app/services/backtest/simulate-watcher-replay.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BodySchema = z.object({
  startDate: z.string().regex(DAY),
  endDate: z.string().regex(DAY),
  assets: z.array(z.string()).min(1).max(10).optional(),
}).strict();

/**
 * Admin: kick off a continuous watcher-only replay over a long window
 * (e.g. 1 year). No swarm/LLM, so it runs in one request. Returns the
 * created runId; the existing run-detail view renders its trades and
 * equity curve.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  if (Date.parse(`${parsed.data.endDate}T00:00:00Z`) < Date.parse(`${parsed.data.startDate}T00:00:00Z`)) {
    return NextResponse.json({ error: "endDate before startDate" }, { status: 400 });
  }

  const [instance] = await db.select().from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  try {
    const result = await runWatcherReplay({ instance, startDate: parsed.data.startDate, endDate: parsed.data.endDate, assets: parsed.data.assets });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
