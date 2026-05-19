import "server-only";

import { db } from "@/lib/db/client";
import { trades, selboInstances, type Trade } from "@/lib/db/schema";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { recordTradeMemory } from "@/app/services/memory.service";
import {
  anchorClosedTrade,
  anchorOpenedTrade,
  type AnchorJsonValue,
} from "@/lib/arc/anchor";
import { chargeBrokerFee } from "@/app/services/brokerage/charge-fee.service";
import { fetchAllMids } from "@/lib/data-sources/hyperliquid";
import type { TradeQualityReport } from "@/app/services/trade-quality-engine";

export type OpenPaperTradeInput = {
  userId: string;
  // User's Circle Dev Wallet id; required because the trade-open anchor
  // emits from this wallet so on-chain events carry the user's address.
  walletId: string;
  asset: string;
  side: "long" | "short";
  sizeUsd: number;
  entryPriceUsd: number | null;
  stopLossPriceUsd?: number | null;
  takeProfitPriceUsd?: number | null;
  source: "watcher" | "fast-trader" | "panel";
  rationale: string;
  decisionReport?: TradeQualityReport | null;
  // Full agent context the deciding LLM saw. Hashed into the Arc open
  // anchor trace; never stored plain on-chain. Optional so paths without
  // it still open trades; the anchor just hashes rationale + safety.
  agentContext?: AnchorJsonValue;
};

export type ClosePaperTradeInput = {
  userId: string;
  // User's Circle Dev Wallet id; required because the close anchor emits
  // from this wallet so on-chain events carry the user's address.
  walletId: string;
  selboInstanceId: string;
  asset: string;
  markPriceUsd: number | null;
  rationale: string;
  source: "watcher" | "fast-trader" | "panel" | "safety" | "user-pause";
  safetyTrigger?: "stop_loss" | "take_profit";
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
 * Sanity-check a candidate stop / take-profit level against the entry
 * direction. Inverted levels (e.g. long stop above entry) would fire
 * instantly and indicate the agent confused itself; drop them with a
 * warning instead of poisoning the trade.
 */
function sanitizeSafetyLevels(
  side: "long" | "short",
  entry: number | null,
  stop: number | null | undefined,
  takeProfit: number | null | undefined,
): { stop: number | null; takeProfit: number | null } {
  if (entry === null) return { stop: null, takeProfit: null };
  const out = { stop: stop ?? null, takeProfit: takeProfit ?? null };
  if (side === "long") {
    if (out.stop !== null && out.stop >= entry) out.stop = null;
    if (out.takeProfit !== null && out.takeProfit <= entry) out.takeProfit = null;
  } else {
    if (out.stop !== null && out.stop <= entry) out.stop = null;
    if (out.takeProfit !== null && out.takeProfit >= entry) out.takeProfit = null;
  }
  return out;
}

/**
 * Insert a new open paper-mode trade row. Both Fast Trader (`execute`
 * tier) and the orchestrator's panel-execution path call this. Anchor
 * on Arc happens at close, not open. Safety levels persisted here are
 * later enforced by the cron-driven enforcer.
 */
export async function openPaperTrade(input: OpenPaperTradeInput): Promise<{ tradeId: string }> {
  const asset = input.asset.toUpperCase();
  const { stop, takeProfit } = sanitizeSafetyLevels(
    input.side,
    input.entryPriceUsd,
    input.stopLossPriceUsd,
    input.takeProfitPriceUsd,
  );

  const [row] = await db
    .insert(trades)
    .values({
      userId: input.userId,
      asset,
      venue: "hyperliquid",
      side: input.side,
      amountUsd: input.sizeUsd.toString(),
      entryPrice: input.entryPriceUsd ? input.entryPriceUsd.toString() : null,
      stopLossPriceUsd: stop !== null ? stop.toString() : null,
      takeProfitPriceUsd: takeProfit !== null ? takeProfit.toString() : null,
      decisionReport: input.decisionReport ? input.decisionReport as unknown as Record<string, unknown> : null,
      status: "open",
      mode: "simulation",
      openedAt: new Date(),
    })
    .returning({ id: trades.id });
  if (!row) throw new Error("paper-trade insert returned no row");
  const tradeId = row.id;
  console.log(
    `[paper-trade] OPEN ${input.side} ${asset} $${input.sizeUsd} @ ${input.entryPriceUsd} (stop=${stop}, tp=${takeProfit}) via ${input.source}`,
  );

  // Awaited Arc open-anchor (M5). Trade is already persisted before this
  // call so the row exists even if Circle errors. Awaited (not fire-and-
  // forget) because Cloudflare Workers cancel post-handler async work
  // unless wrapped in waitUntil, which Next.js route handlers don't expose.
  // ~1-2s added to trade-open latency; acceptable at hackathon scale.
  try {
    const res = await anchorOpenedTrade({
      walletId: input.walletId,
      tradeId,
      asset,
      side: input.side,
      amountUsd: input.sizeUsd.toString(),
      leverage: null,
      entryPrice: input.entryPriceUsd ? input.entryPriceUsd.toString() : null,
      reasoning: {
        rationale: input.rationale,
        source: input.source,
        stopLossPriceUsd: stop,
        takeProfitPriceUsd: takeProfit,
        decisionReport: input.decisionReport ?? null,
        agentContext: input.agentContext ?? null,
      },
    });
    if (res?.txId) {
      await db.update(trades).set({ openAnchorTx: res.txId }).where(eq(trades.id, tradeId));
    }
  } catch (err) {
    console.error("[paper-trade] anchorOpenedTrade failed:", err);
  }

  return { tradeId };
}

/**
 * Close the most recent open paper trade for (userId, asset). Stamps
 * realized PnL into the user's simulated balance, fires memory + Arc
 * anchor non-blocking. When called by the safety enforcer, records the
 * triggering reason on the trade row for UI surfacing.
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
      safetyTriggerReason: input.safetyTrigger ?? null,
    })
    .where(eq(trades.id, target.id));

  if (pnl !== null) {
    await db
      .update(selboInstances)
      .set({
        simulatedBalanceUsd: sql`${selboInstances.simulatedBalanceUsd} + ${pnl.toString()}`,
      })
      .where(eq(selboInstances.id, input.selboInstanceId));
  }

  // Fire-and-forget brokerage fee: min($0.10, sizeUsd * 2%) USDC from the
  // user's Circle wallet to the Selbo treasury. Idempotent via the unique
  // index on broker_fees.trade_id so retries can't double-charge.
  chargeBrokerFee({
    userId: input.userId, walletId: input.walletId, tradeId: target.id,
    sizeUsd: Number(target.amountUsd), pnlUsd: pnl,
  }).catch((err) => console.error("[paper-trade] broker fee:", err));

  const closedTrade = {
    ...target,
    status: "closed",
    closedAt,
    exitPrice: input.markPriceUsd.toString(),
    pnlUsd: pnl !== null ? pnl.toString() : null,
  };
  void recordTradeMemory(closedTrade);
  // Awaited (same reasoning as open-anchor above): Workers cancel
  // post-handler async work without waitUntil, so fire-and-forget would
  // sometimes leave arcAnchorTx null even when Circle queued a tx.
  try {
    const res = await anchorClosedTrade({
      walletId: input.walletId,
      tradeId: target.id,
      asset: target.asset,
      side: target.side,
      amountUsd: target.amountUsd.toString(),
      entryPrice: target.entryPrice ? target.entryPrice.toString() : null,
      exitPrice: input.markPriceUsd.toString(),
      pnlUsd: pnl !== null ? pnl.toString() : null,
      reasoning: {
        rationale: input.rationale,
        source: input.source,
        safetyTrigger: input.safetyTrigger ?? null,
        decisionReport: target.decisionReport ?? null,
      },
    });
    if (res?.txId) {
      await db.update(trades).set({ arcAnchorTx: res.txId }).where(eq(trades.id, target.id));
    }
  } catch (err) {
    console.error("[paper-trade] anchorClosedTrade failed:", err);
  }

  console.log(`[paper-trade] CLOSE ${asset} @ ${input.markPriceUsd}; pnl=${pnl} via ${input.source}`);
  return { tradeId: target.id, pnlUsd: pnl };
}

/**
 * Scan every open paper trade. For each with a stop_loss or take_profit
 * level set, fetch the current Hyperliquid mid and close the position
 * when mark has crossed either side. Runs inside the watcher tick cron
 * so we don't pay extra Worker invocations. The agent set the
 * thresholds; this service just enforces them.
 */
export async function enforceSafetyTriggers(): Promise<{ scanned: number; triggered: number }> {
  const open = await db
    .select({
      id: trades.id,
      userId: trades.userId,
      asset: trades.asset,
      side: trades.side,
      entryPrice: trades.entryPrice,
      stopLossPriceUsd: trades.stopLossPriceUsd,
      takeProfitPriceUsd: trades.takeProfitPriceUsd,
    })
    .from(trades)
    .where(and(
      eq(trades.status, "open"),
      // Only rows with at least one safety level set are eligible.
      isNull(trades.exitPrice),
      isNotNull(trades.entryPrice),
    ));

  const scannable = open.filter(
    (r) => r.stopLossPriceUsd !== null || r.takeProfitPriceUsd !== null,
  );
  if (scannable.length === 0) return { scanned: 0, triggered: 0 };

  const mids = await fetchAllMids().catch(() => ({} as Record<string, string>));
  let triggered = 0;

  for (const r of scannable) {
    const mark = mids[r.asset.toUpperCase()];
    if (!mark) continue;
    const markN = Number(mark);
    const stop = r.stopLossPriceUsd ? Number(r.stopLossPriceUsd) : null;
    const tp = r.takeProfitPriceUsd ? Number(r.takeProfitPriceUsd) : null;
    let reason: "stop_loss" | "take_profit" | null = null;
    if (r.side === "long") {
      if (stop !== null && markN <= stop) reason = "stop_loss";
      else if (tp !== null && markN >= tp) reason = "take_profit";
    } else if (r.side === "short") {
      if (stop !== null && markN >= stop) reason = "stop_loss";
      else if (tp !== null && markN <= tp) reason = "take_profit";
    }
    if (!reason) continue;

    const [inst] = await db
      .select({ id: selboInstances.id, walletId: selboInstances.circleWalletId })
      .from(selboInstances)
      .where(eq(selboInstances.userId, r.userId))
      .limit(1);
    if (!inst) continue;

    await closePaperTrade({
      userId: r.userId,
      walletId: inst.walletId,
      selboInstanceId: inst.id,
      asset: r.asset,
      markPriceUsd: markN,
      source: "safety",
      safetyTrigger: reason,
      rationale: `safety enforcement: ${reason} at ${markN}`,
    });
    triggered++;
  }

  return { scanned: scannable.length, triggered };
}
