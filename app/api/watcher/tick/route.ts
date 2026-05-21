import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { runWatcherForInstance } from "@/app/services/watcher/watcher.service";
import { pollPendingAnchors } from "@/lib/arc/anchor";
import { enforceSafetyTriggers } from "@/app/services/trades/paper-trade.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron heartbeat endpoint. Called by an external scheduler (cron-job.org)
 * in production; point a job at this URL every few minutes. Locally there
 * is no automatic cron, so fire ticks manually via /api/watcher/force-tick
 * or the dev strip's Force tick button. (Do NOT add a Vercel cron: the
 * Hobby plan only allows daily Vercel crons, and scheduling already runs
 * through cron-job.org.)
 *
 * Body of work: find Selbo instances whose `next_watcher_at <= now()` and
 * whose kill switch is off, run a watcher tick for each. The watcher
 * service writes back `next_watcher_at` per its agent-chosen delay, so
 * this endpoint stays state-free.
 *
 * Auth: shared secret in `Authorization: Bearer ${CRON_SECRET}` header,
 * set as CRON_SECRET in the Vercel project env and as the bearer header on
 * the cron-job.org job.
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
  // Private-beta gate: skip ungranted instances entirely so no LLM spend
  // happens on accounts that signed up without redeeming a code.
  const due = await db
    .select()
    .from(selboInstances)
    .where(and(
      lte(selboInstances.nextWatcherAt, now),
      eq(selboInstances.killSwitchActive, false),
      eq(selboInstances.betaAccessGranted, true),
    ));

  const results = await Promise.allSettled(
    due.map((i) => runWatcherForInstance(i.id)),
  );

  const summary = due.map((instance, idx) => {
    const r = results[idx];
    if (!r) return { instanceId: instance.id, status: "missing" as const };
    return {
      instanceId: instance.id,
      status: r.status,
      ...(r.status === "fulfilled"
        ? { verdict: r.value.verdict, nextCheckSeconds: r.value.nextCheckSeconds }
        : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
    };
  });

  // Piggyback the anchor-status poll on the same cron heartbeat so we don't
  // double Worker invocations. Cheap query: only scans trades with a pending
  // Circle tx id and no resolved on-chain hash.
  let anchorPoll: { scanned: number; resolved: number; failed: number } | null = null;
  try {
    anchorPoll = await pollPendingAnchors();
  } catch (err) {
    console.error("[tick] pollPendingAnchors threw:", err);
  }

  // Stop-loss / take-profit enforcement. Single SQL scan + Hyperliquid
  // mids fetch shared across all open positions. Closes any position
  // whose mark has crossed an agent-set safety level since the last tick.
  let safetyEnforcement: { scanned: number; triggered: number } | null = null;
  try {
    safetyEnforcement = await enforceSafetyTriggers();
  } catch (err) {
    console.error("[tick] enforceSafetyTriggers threw:", err);
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    count: due.length,
    results: summary,
    anchorPoll,
    safetyEnforcement,
  });
}

// GET alias so manual `curl` works without -X POST during dev.
export const GET = POST;
