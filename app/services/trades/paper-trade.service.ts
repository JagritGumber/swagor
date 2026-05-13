import "server-only";

import { db } from "@/lib/db/client";
import { trades, solonInstances, type Trade } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { recordTradeMemory } from "@/app/services/memory.service";
import { anchorClosedTrade } from "@/lib/arc/anchor";

export type OpenPaperTradeInput = {
  userId: string;
  asset: string;
  side: "long" | "short";
  sizeUsd: number;
  entryPriceUsd: number | null;
  source: "fast-trader" | "panel";
  rationale: string;
};

export type ClosePaperTradeInput = {
  userId: string;
  solonInstanceId: string;
  asset: string;
  markPriceUsd: number | null;
  rationale: string;
  source: "fast-trader" | "panel";
};

/**
 * Compute realized PnL for a closed long/short paper position at the given exit price.
 */
export function computePnl(t: Trade, exit: number): number | null {
  const entry = t.entryPrice ? Number(t.entryPrice) : null;
  if (entry === null || entry <= 0) return null;
  const amt = Number(t.amountUsd);
  const move = t.side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return amt * move;
}

/**
 * Insert a new open paper-mode trade row. Used by both Fast Trader on
 * `execute` ticks and by the orchestrator after a deliberate cycle
 * approves an actionable decision. Anchoring on Arc happens at close.
 */
export async function openPaperTrade(input: OpenPaperTradeInput): Promise<{ tradeId: string }> {
  const asset = input.asset.toUpperCase();
  const [row] = await db
    .insert(trades)
    .values({
      userId: input.userId,
      asset,
      venue: "hyperliquid",
      side: input.side,
      amountUsd: input.sizeUsd.toString(),
      entryPrice: input.entryPriceUsd ? input.entryPriceUsd.toString() : null,
      status: "open",
      mode: "simulation",
      openedAt: new Date(),
    })
    .returning({ id: trades.id });
  console.log(
    `[paper-trade] OPEN ${input.side} ${asset} $${input.sizeUsd} @ ${input.entryPriceUsd} via ${input.source}`,
  );
  return { tradeId: row!.id };
}

/**
 * Close the most recent open paper trade for (userId, asset) at the given
 * mark price. Rolls realized PnL into the user's simulated balance, then
 * fires the memory keeper and Arc anchor non-blocking. No-op if no
 * matching open trade or mark price is unavailable.
 */
export async function closePaperTrade(
  input: ClosePaperTradeInput,
): Promise<{ tradeId: string; pnlUsd: number | null } | null> {
  const asset = input.asset.toUpperCase();
  if (input.markPriceUsd === null) {
    console.log(`[paper-trade] CLOSE ${asset} skipped: no mark price`);
    return null;
  }

  const [target] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, input.userId), eq(trades.asset, asset), eq(trades.status, "open")))
    .orderBy(desc(trades.openedAt))
    .limit(1);

  if (!target) {
    console.log(`[paper-trade] CLOSE ${asset} skipped: no matching open trade`);
    return null;
  }

  const pnl = computePnl(target, input.markPriceUsd);
  const closedAt = new Date();
  await db
    .update(trades)
    .set({
      status: "closed",
      closedAt,
      exitPrice: input.markPriceUsd.toString(),
      pnlUsd: pnl !== null ? pnl.toString() : null,
    })
    .where(eq(trades.id, target.id));

  if (pnl !== null) {
    await db
      .update(solonInstances)
      .set({
        simulatedBalanceUsd: sql`${solonInstances.simulatedBalanceUsd} + ${pnl.toString()}`,
      })
      .where(eq(solonInstances.id, input.solonInstanceId));
  }

  const closedTrade = {
    ...target,
    status: "closed",
    closedAt,
    exitPrice: input.markPriceUsd.toString(),
    pnlUsd: pnl !== null ? pnl.toString() : null,
  };
  void recordTradeMemory(closedTrade);
  void anchorClosedTrade({
    tradeId: target.id,
    asset: target.asset,
    side: target.side,
    amountUsd: target.amountUsd.toString(),
    entryPrice: target.entryPrice ? target.entryPrice.toString() : null,
    exitPrice: input.markPriceUsd.toString(),
    pnlUsd: pnl !== null ? pnl.toString() : null,
    reasoning: { rationale: input.rationale, source: input.source },
  })
    .then((res) => {
      if (res?.txId) {
        void db.update(trades).set({ arcAnchorTx: res.txId }).where(eq(trades.id, target.id));
      }
    })
    .catch((err) => console.error("[paper-trade] anchorClosedTrade failed:", err));

  console.log(`[paper-trade] CLOSE ${asset} @ ${input.markPriceUsd}; pnl=${pnl} via ${input.source}`);
  return { tradeId: target.id, pnlUsd: pnl };
}
