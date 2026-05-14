import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { monitorTicks, selboInstances } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { runWatcherForInstance } from "@/app/services/watcher/watcher.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MS = 10_000;

/**
 * Dev-only: run a watcher tick for the authed user's Selbo instance
 * regardless of next_watcher_at. Throttled to once per 10s so a button
 * mash can't burn the watcher LLM in a loop.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  if (!instance.betaAccessGranted) {
    return NextResponse.json(
      { ok: false, error: "Beta access required. Redeem a code first." },
      { status: 403 },
    );
  }

  const [lastTick] = await db
    .select({ createdAt: monitorTicks.createdAt })
    .from(monitorTicks)
    .where(eq(monitorTicks.selboInstanceId, instance.id))
    .orderBy(desc(monitorTicks.createdAt))
    .limit(1);
  if (lastTick?.createdAt) {
    const ageMs = Date.now() - new Date(lastTick.createdAt).getTime();
    if (ageMs < COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((COOLDOWN_MS - ageMs) / 1000);
      return NextResponse.json(
        { ok: false, error: `Cooldown: try again in ${retryAfterSec}s` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }
  }

  try {
    const result = await runWatcherForInstance(instance.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
