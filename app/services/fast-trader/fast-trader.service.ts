import "server-only";

import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { traderLlm, MODELS } from "@/lib/llm-client";
import { fetchAllMids, fetchMetaAndCtxs, fetchClearinghouse } from "@/lib/data-sources/hyperliquid";
import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { FAST_TRADER_SCHEMA, FAST_TRADER_SYSTEM_PROMPT, type FastTraderDecision } from "./prompt";
import {
  openPaperTrade,
  closePaperTrade,
} from "@/app/services/trades/paper-trade.service";

/**
 * Run the Fast Trader for a Solon instance. Fetches fresh Hyperliquid state,
 * calls the trader-tier LLM, and routes by action through the shared
 * paper-trade helpers so the open/close logic stays consistent with the
 * orchestrator's panel-execution path.
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

  const hlPositions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin, size: p.position.szi, entry: p.position.entryPx,
    leverage: p.position.leverage, liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
  })) ?? [];

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
  const rationale = `${watcherRationale} | trader: ${decision.rationale}`;

  if (decision.action === "open_long" || decision.action === "open_short") {
    const side = decision.action === "open_long" ? "long" : "short";
    // Translate the trader's percentage triggers into absolute price levels
    // for the safety enforcer. Pcts are positive numbers regardless of side.
    let stopLossPriceUsd: number | null = null;
    let takeProfitPriceUsd: number | null = null;
    if (markPx !== null) {
      if (decision.stop_loss_pct !== null) {
        const mult = side === "long" ? 1 - decision.stop_loss_pct / 100 : 1 + decision.stop_loss_pct / 100;
        stopLossPriceUsd = markPx * mult;
      }
      if (decision.take_profit_pct !== null) {
        const mult = side === "long" ? 1 + decision.take_profit_pct / 100 : 1 - decision.take_profit_pct / 100;
        takeProfitPriceUsd = markPx * mult;
      }
    }
    await openPaperTrade({
      userId: instance.userId,
      asset: assetUpper,
      side,
      sizeUsd: decision.size_usd,
      entryPriceUsd: markPx,
      stopLossPriceUsd,
      takeProfitPriceUsd,
      source: "fast-trader",
      rationale,
    });
  } else if (decision.action === "close") {
    await closePaperTrade({
      userId: instance.userId,
      solonInstanceId: instance.id,
      asset: assetUpper,
      markPriceUsd: markPx,
      source: "fast-trader",
      rationale,
    });
  } else {
    console.log(`[fast-trader] HOLD for ${instance.id}: ${decision.rationale}`);
  }

  return decision;
}
