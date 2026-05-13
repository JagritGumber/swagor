import "server-only";

import { db } from "@/lib/db/client";
import { trades, type Trade } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { traderLlm, MODELS } from "@/lib/llm-client";
import { fetchAllMids, fetchMetaAndCtxs, fetchClearinghouse } from "@/lib/data-sources/hyperliquid";
import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { FAST_TRADER_SCHEMA, FAST_TRADER_SYSTEM_PROMPT, type FastTraderDecision } from "./prompt";

/**
 * Compute paper-mode PnL for a closed position at the given exit price.
 * Long: (exit-entry)/entry * notional. Short: (entry-exit)/entry * notional.
 */
function computePnl(t: Trade, exit: number): number | null {
  const entry = t.entryPrice ? Number(t.entryPrice) : null;
  if (entry === null || entry <= 0) return null;
  const amt = Number(t.amountUsd);
  const move = t.side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return amt * move;
}

/**
 * Run the Fast Trader for a Solon instance. Fetches fresh Hyperliquid state,
 * calls the trader-tier LLM, and routes by action:
 *   - open_long / open_short: insert a new `trades` row with status=open
 *   - close: find the most recent open trade for `asset`, mark closed with
 *            exit price + computed PnL
 *   - hold: no-op
 */
export async function runFastTraderForInstance(
  instance: SolonInstance,
  watcherRationale: string,
): Promise<FastTraderDecision> {
  const [mids, meta, clearing] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
  ]);

  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];
  const ctxByCoin = new Map(meta.universe.map((u, i) => [u.name.toUpperCase(), meta.ctxs[i]]));
  const perps = watching.map((sym) => {
    const upper = sym.toUpperCase();
    const ctx = ctxByCoin.get(upper);
    return {
      symbol: upper,
      mark: ctx?.markPx ?? mids[upper] ?? null,
      funding_hourly: ctx?.funding ?? null,
    };
  });

  // Hyperliquid positions for context (live equity / position state).
  const hlPositions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin, size: p.position.szi, entry: p.position.entryPx,
    leverage: p.position.leverage, liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
  })) ?? [];

  // Paper-mode open positions for the prompt (so the trader knows what to close).
  const paperOpen = await db.select().from(trades)
    .where(and(eq(trades.userId, instance.userId), eq(trades.status, "open")));
  const paperPositions = paperOpen.map((t) => ({
    asset: t.asset, side: t.side, size_usd: Number(t.amountUsd),
    entry: t.entryPrice ? Number(t.entryPrice) : null,
    opened_at: t.openedAt,
  }));

  const payload = JSON.stringify({
    strategy: instance.strategyText,
    watcher_rationale: watcherRationale,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : { equity: instance.simulatedBalanceUsd, withdrawable: instance.simulatedBalanceUsd },
    paper_positions: paperPositions,
    hl_positions: hlPositions,
    perps,
  });

  const completion = await traderLlm.chat.completions.create({
    model: MODELS.TRADER,
    messages: [
      { role: "system", content: FAST_TRADER_SYSTEM_PROMPT },
      { role: "user", content: payload },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("fast-trader returned empty response");
  const decision = FAST_TRADER_SCHEMA.parse(JSON.parse(raw));

  const assetUpper = decision.asset.toUpperCase();
  const markPx = mids[assetUpper] ? Number(mids[assetUpper]) : null;

  if (decision.action === "open_long" || decision.action === "open_short") {
    await db.insert(trades).values({
      userId: instance.userId, asset: assetUpper, venue: "hyperliquid",
      side: decision.action === "open_long" ? "long" : "short",
      amountUsd: decision.size_usd.toString(),
      entryPrice: markPx ? markPx.toString() : null,
      status: "open", mode: "simulation", openedAt: new Date(),
    });
    console.log(`[fast-trader] OPEN ${decision.action} ${assetUpper} $${decision.size_usd} ${decision.leverage}x @ ${markPx}`);
  } else if (decision.action === "close") {
    const [target] = await db.select().from(trades)
      .where(and(eq(trades.userId, instance.userId), eq(trades.asset, assetUpper), eq(trades.status, "open")))
      .orderBy(desc(trades.openedAt)).limit(1);
    if (target && markPx !== null) {
      const pnl = computePnl(target, markPx);
      await db.update(trades).set({
        status: "closed", closedAt: new Date(),
        exitPrice: markPx.toString(),
        pnlUsd: pnl !== null ? pnl.toString() : null,
      }).where(eq(trades.id, target.id));
      console.log(`[fast-trader] CLOSE ${assetUpper} @ ${markPx}; pnl=${pnl}`);
    } else {
      console.log(`[fast-trader] CLOSE asked but no open ${assetUpper} position`);
    }
  } else {
    console.log(`[fast-trader] HOLD for ${instance.id}: ${decision.rationale}`);
  }

  return decision;
}
