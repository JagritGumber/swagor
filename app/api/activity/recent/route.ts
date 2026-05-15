import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { monitorTicks, trades, selboInstances } from "@/lib/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { ActivityEvent, ActivityTickEvent } from "@/lib/utils/activity-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampLimit(raw: string | null): number {
  const parsed = Number(raw ?? "30");
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

/**
 * GET /api/activity/recent?limit=30
 *
 * Unified chronological stream of watcher ticks + trade opens + trade
 * closes for the caller's Selbo instance. Newest first. Used by the
 * dashboard activity tape so the user can see all agent action without
 * scanning multiple cards.
 *
 * Implementation: fetch the most recent N rows from each event source,
 * sort by ts, take top N. Trade opens and closes are queried separately
 * because a fresh close can belong to an old trade row.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));

  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ events: [], nextWatcherAt: null });

  const [tickRows, tradeOpenRows, tradeCloseRows] = await Promise.all([
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.selboInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt))
      .limit(limit),
    db.select().from(trades)
      .where(and(eq(trades.userId, user.id), isNotNull(trades.openedAt)))
      .orderBy(desc(trades.openedAt))
      .limit(limit),
    db.select().from(trades)
      .where(and(eq(trades.userId, user.id), isNotNull(trades.closedAt)))
      .orderBy(desc(trades.closedAt))
      .limit(limit),
  ]);

  const events: ActivityEvent[] = [];
  for (const t of tickRows) {
    events.push({
      kind: "tick",
      id: t.id,
      ts: t.createdAt.toISOString(),
      verdict: t.verdict as ActivityTickEvent["verdict"],
      rationale: t.rationale,
      nextCheckSeconds: t.nextCheckSeconds,
    });
  }
  for (const t of tradeOpenRows) {
    const side = t.side === "short" ? "short" : "long";
    if (t.openedAt) {
      events.push({
        kind: "trade_open", id: t.id, ts: t.openedAt.toISOString(),
        asset: t.asset, side, sizeUsd: t.amountUsd, entryPrice: t.entryPrice,
      });
    }
  }
  for (const t of tradeCloseRows) {
    const side = t.side === "short" ? "short" : "long";
    if (t.closedAt) {
      events.push({
        kind: "trade_close", id: t.id, ts: t.closedAt.toISOString(),
        asset: t.asset, side, pnlUsd: t.pnlUsd, exitPrice: t.exitPrice,
        reason: t.safetyTriggerReason,
      });
    }
  }

  events.sort((a, b) => b.ts.localeCompare(a.ts));
  return NextResponse.json({
    events: events.slice(0, limit),
    nextWatcherAt: instance.nextWatcherAt,
  });
}
