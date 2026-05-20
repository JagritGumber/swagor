import { db } from "@/lib/db/client";
import { trades, selboInstances } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import { anchorOpenedTrade, anchorClosedTrade, pollPendingAnchors, type AnchorJsonValue } from "@/lib/arc/anchor";

/**
 * Backfill on-chain anchors for live paper trades, SERIALIZED. EVM
 * chains cap queued txs per sender (Circle 155264), so we fire one
 * anchor, then poll until the per-sender queue drains, before the next.
 * Idempotent: only fires where the anchor tx id is still null, so a
 * re-run resumes and drains stragglers.
 * Run: bun --conditions react-server scripts/arc-backfill-trades.ts
 */
const queuedLeft = async (): Promise<number> => (await db.select({ n: sql<number>`count(*)::int` }).from(trades)
  .where(or(and(isNotNull(trades.openAnchorTx), isNull(trades.openOnchainTxHash)), and(isNotNull(trades.arcAnchorTx), isNull(trades.arcOnchainTxHash)))))[0].n;

async function drain(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    await pollPendingAnchors();
    if (await queuedLeft() === 0) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

console.log("draining any already-queued trade anchors first...");
await drain();

const rows = await db.select({
  id: trades.id, asset: trades.asset, side: trades.side, amount: trades.amountUsd,
  entry: trades.entryPrice, exit: trades.exitPrice, pnl: trades.pnlUsd, status: trades.status,
  reason: trades.decisionReport, openTx: trades.openAnchorTx, closeTx: trades.arcAnchorTx,
  wallet: selboInstances.circleWalletId,
}).from(trades).innerJoin(selboInstances, eq(trades.userId, selboInstances.userId));

for (const t of rows) {
  if (!t.wallet) { console.log("  skip", t.id.slice(0, 8), "(no wallet)"); continue; }
  if (!t.openTx) {
    const r = await anchorOpenedTrade({ walletId: t.wallet, tradeId: t.id, asset: t.asset, side: t.side as "long" | "short", amountUsd: t.amount, leverage: null, entryPrice: t.entry, reasoning: (t.reason ?? {}) as unknown as AnchorJsonValue });
    if (r?.txId) { await db.update(trades).set({ openAnchorTx: r.txId }).where(eq(trades.id, t.id)); console.log("  open  anchored", t.id.slice(0, 8)); await drain(); }
  }
  if (t.status === "closed" && !t.closeTx) {
    const r = await anchorClosedTrade({ walletId: t.wallet, tradeId: t.id, asset: t.asset, side: t.side, amountUsd: t.amount, entryPrice: t.entry, exitPrice: t.exit, pnlUsd: t.pnl, reasoning: t.reason ?? {} });
    if (r?.txId) { await db.update(trades).set({ arcAnchorTx: r.txId }).where(eq(trades.id, t.id)); console.log("  close anchored", t.id.slice(0, 8)); await drain(); }
  }
}
console.log("DONE; queued-left =", await queuedLeft());
process.exit(0);
