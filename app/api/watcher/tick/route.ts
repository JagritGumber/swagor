import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { runWatcherForInstance } from "@/app/services/watcher/watcher.service";
import { pollPendingAnchors } from "@/lib/arc/anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron heartbeat endpoint. Called by Cloudflare Cron Triggers (configured
 * in wrangler.toml) every 60 seconds in production. Locally there's no
 * automatic cron — fire ticks manually via /api/watcher/force-tick or
 * the dev strip's Force tick button.
 *
 * Body of work: find Solon instances whose `next_watcher_at <= now()` and
 * whose kill switch is off, run a watcher tick for each. The watcher
 * service writes back `next_watcher_at` per its agent-chosen delay, so
 * this endpoint stays state-free.
 *
 * Auth: shared secret in `Authorization: Bearer ${CRON_SECRET}` header,
 * set in production via `wrangler secret put CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  // In production CRON_SECRET MUST be set, otherwise anyone hitting the
  // URL can trigger watcher ticks for every due instance and burn LLM
  // tokens. Local dev keeps the no-auth path so the dev strip works
  // without piping a header.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 503 },
      );
    }
  } else {
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

  // Piggyback the anchor-status poll on the same cron heartbeat so we don't
  // double Worker invocations. Cheap query: only scans trades with a pending
  // Circle tx id and no resolved on-chain hash.
  let anchorPoll: { scanned: number; resolved: number; failed: number } | null = null;
  try {
    anchorPoll = await pollPendingAnchors();
  } catch (err) {
    console.error("[tick] pollPendingAnchors threw:", err);
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    count: due.length,
    results: summary,
    anchorPoll,
  });
}

// GET alias so manual `curl` works without -X POST during dev.
export const GET = POST;
