import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { equitySnapshots } from "@/lib/db/schema";
import { and, eq, gte, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/equity/recent?days=7
 *
 * Returns the caller's equity snapshots within the past N days plus
 * lifetime aggregates. With a single row, lifetime fields collapse to
 * that one value -- the dashboard shows a placeholder card until N>=2.
 */
function clampDays(raw: string | null): number {
  const parsed = Number(raw ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.floor(parsed), 1), 90);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const { searchParams } = new URL(request.url);
  const days = clampDays(searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(equitySnapshots)
    .where(and(eq(equitySnapshots.userId, user.id), gte(equitySnapshots.takenAt, since)))
    .orderBy(asc(equitySnapshots.takenAt));

  if (rows.length === 0) {
    return NextResponse.json({
      snapshots: [],
      lifetime: { start: null, high: null, low: null },
    });
  }

  let highVal = Number(rows[0]!.equityUsd);
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
    lifetime: {
      start: Number(rows[0]!.equityUsd),
      high: highVal,
      low: lowVal,
    },
  });
}
