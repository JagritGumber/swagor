import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { memoryEntries, trades } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/memory
 *
 * Returns the caller's non-deleted memory entries with the linked trade
 * (asset, side, pnl) so the user can see WHAT each lesson came from.
 * Newest first. Bad-rated rows are returned but flagged via userFeedback
 * so the UI can render the thumbs-down state.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: memoryEntries.id,
      lessons: memoryEntries.lessons,
      outcome: memoryEntries.outcome,
      pnlPct: memoryEntries.pnlPct,
      userFeedback: memoryEntries.userFeedback,
      createdAt: memoryEntries.createdAt,
      tradeId: memoryEntries.tradeId,
      tradeAsset: trades.asset,
      tradeSide: trades.side,
    })
    .from(memoryEntries)
    .leftJoin(trades, eq(memoryEntries.tradeId, trades.id))
    .where(and(
      eq(memoryEntries.userId, session.user.id),
      isNull(memoryEntries.deletedAt),
    ))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(100);

  return NextResponse.json({ memories: rows });
}
