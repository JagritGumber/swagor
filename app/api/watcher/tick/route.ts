import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { runWatcherForInstance } from "@/app/services/watcher/watcher.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron heartbeat endpoint. Vercel cron hits this every 60 seconds.
 * Body of work: find Solon instances whose `next_watcher_at <= now()` and
 * whose kill switch is off, run a watcher tick for each. The watcher
 * service writes back `next_watcher_at` per its agent-chosen delay, so
 * this endpoint stays state-free.
 *
 * Auth: shared secret in `Authorization: Bearer ${CRON_SECRET}` header.
 * Vercel cron sets this automatically when `CRON_SECRET` is in env.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const due = await db
    .select()
    .from(solonInstances)
    .where(and(
      lte(solonInstances.nextWatcherAt, now),
      eq(solonInstances.killSwitchActive, false),
    ));

  const results = await Promise.allSettled(
    due.map((i) => runWatcherForInstance(i.id)),
  );

  const summary = results.map((r, idx) => ({
    instanceId: due[idx]!.id,
    status: r.status,
    ...(r.status === "fulfilled"
      ? { verdict: r.value.verdict, nextCheckSeconds: r.value.nextCheckSeconds }
      : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
  }));

  return NextResponse.json({ ranAt: now.toISOString(), count: due.length, results: summary });
}

// GET alias so manual `curl` works without -X POST during dev.
export const GET = POST;
