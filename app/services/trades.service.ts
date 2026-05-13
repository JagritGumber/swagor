import "server-only";

import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

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
