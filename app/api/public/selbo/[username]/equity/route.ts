import { NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { equitySnapshots, selboInstances } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/selbo/{username}/equity?days=30
 *
 * Public variant of /api/equity/recent. No session check; resolves a
 * selbo_instances row by (username, publicProfile=true) and returns its
 * equity snapshots in the same shape EquityCurve already consumes.
 */
function clampDays(raw: string | null): number {
  const parsed = Number(raw ?? "30");
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.floor(parsed), 1), 90);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;

  const [instance] = await db.select({ id: selboInstances.id })
    .from(selboInstances)
    .where(and(
      eq(selboInstances.username, username),
      eq(selboInstances.publicProfile, true),
    ))
    .limit(1);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const days = clampDays(searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db.select().from(equitySnapshots)
    .where(and(
      eq(equitySnapshots.selboInstanceId, instance.id),
      gte(equitySnapshots.takenAt, since),
    ))
    .orderBy(asc(equitySnapshots.takenAt))
    .limit(5000);

  const first = rows[0];
  if (!first) {
    return NextResponse.json({
      snapshots: [],
      lifetime: { start: null, high: null, low: null },
    });
  }

  let highVal = Number(first.equityUsd);
  let lowVal = highVal;
  for (const r of rows) {
    const v = Number(r.equityUsd);
    if (Number.isFinite(v)) {
      if (v > highVal) highVal = v;
      if (v < lowVal) lowVal = v;
    }
  }

  return NextResponse.json({
    snapshots: rows.map((r) => ({
      ts: r.takenAt.toISOString(),
      equityUsd: Number(r.equityUsd),
      withdrawableUsd: Number(r.withdrawableUsd),
      openPositions: r.openPositionsCount,
    })),
    lifetime: { start: Number(first.equityUsd), high: highVal, low: lowVal },
  });
}
