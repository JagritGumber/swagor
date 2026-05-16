import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rebalanceCycles, selboInstances } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

/**
 * Admin: list today's swarm cycles. Default scope is the caller's own
 * selbo instance; pass `?all=1` for every instance (still admin-gated).
 * Newest first; capped at 200 rows.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";

  let whereClause;
  if (all) {
    whereClause = gte(rebalanceCycles.startedAt, UTC_DAY_START as unknown as Date);
  } else {
    const [instance] = await db.select({ id: selboInstances.id }).from(selboInstances)
      .where(eq(selboInstances.userId, session.user.id)).limit(1);
    if (!instance) return NextResponse.json({ cycles: [] });
    whereClause = and(
      eq(rebalanceCycles.selboInstanceId, instance.id),
      gte(rebalanceCycles.startedAt, UTC_DAY_START as unknown as Date),
    );
  }

  const rows = await db.select({
    id: rebalanceCycles.id,
    selboInstanceId: rebalanceCycles.selboInstanceId,
    triggeredBy: rebalanceCycles.triggeredBy,
    status: rebalanceCycles.status,
    errorMessage: rebalanceCycles.errorMessage,
    startedAt: rebalanceCycles.startedAt,
    completedAt: rebalanceCycles.completedAt,
  })
    .from(rebalanceCycles).where(whereClause)
    .orderBy(desc(rebalanceCycles.startedAt)).limit(200);

  return NextResponse.json({ cycles: rows });
}
