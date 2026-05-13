import "server-only";

import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type ClosedTradeView = {
  tradeId: string;
  asset: string;
  side: string;
  amountUsd: number;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  openedAt: Date | null;
  closedAt: Date | null;
  arcOnchainTxHash: string | null;
};

function pnlPct(amountUsd: number, pnlUsd: number | null): number | null {
  if (pnlUsd === null || amountUsd <= 0) return null;
  return (pnlUsd / amountUsd) * 100;
}

/**
 * List the user's most recently closed trades. Each row carries either a
 * resolved on-chain tx hash (anchor mined on Arc) or null when the tx is
 * still propagating. Values beginning with "failed:" indicate the Circle
 * tx terminated in a non-success state; the UI hides the anchor link
 * for those rows.
 */
export async function listClosedTrades(
  userId: string,
  limit = 20,
): Promise<ClosedTradeView[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.status, "closed")))
    .orderBy(desc(trades.closedAt))
    .limit(limit);

  return rows.map((r) => {
    const amount = Number(r.amountUsd);
    const pnl = r.pnlUsd ? Number(r.pnlUsd) : null;
    const onchain = r.arcOnchainTxHash;
    return {
      tradeId: r.id,
      asset: r.asset,
      side: r.side,
      amountUsd: amount,
      entryPrice: r.entryPrice ? Number(r.entryPrice) : null,
      exitPrice: r.exitPrice ? Number(r.exitPrice) : null,
      pnlUsd: pnl,
      pnlPct: pnlPct(amount, pnl),
      openedAt: r.openedAt ?? null,
      closedAt: r.closedAt ?? null,
      arcOnchainTxHash: onchain && !onchain.startsWith("failed:") ? onchain : null,
    };
  });
}

export type LifetimeStats = {
  closedTrades: number;
  realizedPnlUsd: number;
  winRate: number | null;
  anchored: number;
  bestPnlPct: number | null;
  worstPnlPct: number | null;
};

/**
 * Aggregate stats across the user's full closed-trade history. Computed in
 * a single SQL pass so the dashboard / public page renders without N rows
 * round-tripping. `winRate` is null when there are no closed trades so the
 * UI can hide the card cleanly. `anchored` only counts trades whose Arc
 * tx mined successfully (excludes failure sentinels).
 */
export async function getLifetimeStats(userId: string): Promise<LifetimeStats> {
  const [row] = await db
    .select({
      closedTrades: sql<number>`count(*) filter (where ${trades.status} = 'closed')`,
      wins: sql<number>`count(*) filter (where ${trades.status} = 'closed' and ${trades.pnlUsd}::numeric > 0)`,
      realizedPnl: sql<string | null>`coalesce(sum(${trades.pnlUsd}::numeric) filter (where ${trades.status} = 'closed'), 0)`,
      anchored: sql<number>`count(*) filter (where ${trades.arcOnchainTxHash} is not null and ${trades.arcOnchainTxHash} not like 'failed:%')`,
      bestPnlPct: sql<string | null>`max(
        case when ${trades.status} = 'closed' and ${trades.amountUsd}::numeric > 0
          then (${trades.pnlUsd}::numeric / ${trades.amountUsd}::numeric) * 100
        end
      )`,
      worstPnlPct: sql<string | null>`min(
        case when ${trades.status} = 'closed' and ${trades.amountUsd}::numeric > 0
          then (${trades.pnlUsd}::numeric / ${trades.amountUsd}::numeric) * 100
        end
      )`,
    })
    .from(trades)
    .where(eq(trades.userId, userId));

  const closedTrades = Number(row?.closedTrades ?? 0);
  const wins = Number(row?.wins ?? 0);
  return {
    closedTrades,
    realizedPnlUsd:
      row?.realizedPnl !== null && row?.realizedPnl !== undefined ? Number(row.realizedPnl) : 0,
    winRate: closedTrades > 0 ? wins / closedTrades : null,
    anchored: Number(row?.anchored ?? 0),
    bestPnlPct:
      row?.bestPnlPct !== null && row?.bestPnlPct !== undefined ? Number(row.bestPnlPct) : null,
    worstPnlPct:
      row?.worstPnlPct !== null && row?.worstPnlPct !== undefined ? Number(row.worstPnlPct) : null,
  };
}
