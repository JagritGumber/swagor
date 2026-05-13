import "server-only";

import { db } from "@/lib/db/client";
import { trades, type Trade } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { fetchAllMids } from "@/lib/data-sources/hyperliquid";

/**
 * View row for a row in the dashboard positions table. Built by joining the
 * latest open trades for this user with live Hyperliquid mark prices, so
 * pnlUsd / pnlPct are computed at read time rather than persisted on every
 * mark-price tick.
 */
export type PositionView = {
  tradeId: string;
  asset: string;
  side: "long" | "short";
  amountUsd: number;
  entryPrice: number | null;
  markPrice: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  openedAt: Date;
};

/**
 * Lists all currently-open trades for a user, enriched with live mark
 * prices from Hyperliquid. Closed trades land in the trade history view.
 */
export async function listOpenPositions(userId: string): Promise<PositionView[]> {
  const [rows, mids] = await Promise.all([
    db.select().from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "open")))
      .orderBy(desc(trades.openedAt)),
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
  ]);

  return rows.map((r: Trade) => {
    const entry = r.entryPrice ? Number(r.entryPrice) : null;
    const mark = mids[r.asset.toUpperCase()] ? Number(mids[r.asset.toUpperCase()]) : null;
    const amt = Number(r.amountUsd);
    const side = (r.side === "long" || r.side === "short") ? r.side : "long";

    let pnlUsd: number | null = null;
    let pnlPct: number | null = null;
    if (entry !== null && mark !== null && entry > 0) {
      const move = side === "long" ? (mark - entry) / entry : (entry - mark) / entry;
      pnlPct = move * 100;
      pnlUsd = amt * move;
    }

    return {
      tradeId: r.id,
      asset: r.asset,
      side,
      amountUsd: amt,
      entryPrice: entry,
      markPrice: mark,
      pnlUsd,
      pnlPct,
      openedAt: r.openedAt ?? r.createdAt,
    };
  });
}
