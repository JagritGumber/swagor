import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rebalanceCycles, selboInstances } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Admin: paginated list of LIVE swarm cycles (backtest cycles are
 * always excluded). Cursor is `before` (ISO timestamp); rows older
 * than that are returned, newest first. Returns `nextBefore` = the
 * startedAt of the last row, or null when no more rows.
 *
 * Query params:
 *   before: ISO timestamp. Default = now.
 *   limit:  1..100. Default = 50.
 *   all:    "1" to span all instances; otherwise scoped to caller's instance.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : new Date();
  if (Number.isNaN(before.getTime())) return NextResponse.json({ error: "Invalid before" }, { status: 400 });
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const all = url.searchParams.get("all") === "1";

  const liveOnly = isNull(rebalanceCycles.backtestRunId);
  const beforeFilter = lt(rebalanceCycles.startedAt, before);
  let whereClause = and(liveOnly, beforeFilter);
  if (!all) {
    const [instance] = await db.select({ id: selboInstances.id }).from(selboInstances)
      .where(eq(selboInstances.userId, session.user.id)).limit(1);
    if (!instance) return NextResponse.json({ cycles: [], nextBefore: null });
    whereClause = and(liveOnly, beforeFilter, eq(rebalanceCycles.selboInstanceId, instance.id));
  }

  const rows = await db.select({
    id: rebalanceCycles.id,
    selboInstanceId: rebalanceCycles.selboInstanceId,
    triggeredBy: rebalanceCycles.triggeredBy,
    status: rebalanceCycles.status,
    errorMessage: rebalanceCycles.errorMessage,
    startedAt: rebalanceCycles.startedAt,
    completedAt: rebalanceCycles.completedAt,
  }).from(rebalanceCycles).where(whereClause)
    .orderBy(desc(rebalanceCycles.startedAt)).limit(limit);

  const nextBefore = rows.length === limit ? rows[rows.length - 1].startedAt.toISOString() : null;
  return NextResponse.json({ cycles: rows, nextBefore });
}
