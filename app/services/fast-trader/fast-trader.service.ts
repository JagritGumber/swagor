import "server-only";

import { db } from "@/lib/db/client";
import { agentReasoning, trades } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { traderLlm, MODELS } from "@/lib/llm-client";
import { fetchAllMids, fetchMetaAndCtxs, fetchClearinghouse } from "@/lib/data-sources/hyperliquid";
import type { SelboInstance } from "@/lib/db/schema/selbo-instances";
import { FAST_TRADER_SCHEMA, FAST_TRADER_SYSTEM_PROMPT, type FastTraderDecision } from "./prompt";
import {
  openPaperTrade,
  closePaperTrade,
} from "@/app/services/trades/paper-trade.service";
import { evaluatePerpRisk, riskNumber } from "@/app/services/risk-engine.service";
import { logLlmCall } from "@/lib/llm/log";
import { buildMarketFeatureSnapshot, type MarketFeatureSnapshot } from "@/lib/market-features";
import { monitorTicks } from "@/lib/db/schema";
import { evaluateSafetyRails, type SafetyBlock } from "@/app/services/safety-rails/safety-check";

function previousMarketFeatures(row: { context: unknown } | undefined): MarketFeatureSnapshot | null {
  const context = row?.context as { marketFeatures?: MarketFeatureSnapshot } | null | undefined;
  return context?.marketFeatures ?? null;
}

async function persistSafetyBlock({
  instance,
  tickId,
  decision,
  block,
  marketFeatures,
}: {
  instance: SelboInstance;
  tickId: string | undefined;
  decision: FastTraderDecision;
  block: SafetyBlock;
  marketFeatures: MarketFeatureSnapshot;
}) {
  const safetyEvent = {
    ...block,
    createdAt: new Date().toISOString(),
  };

  await db.insert(agentReasoning).values({
    cycleId: null,
    agentName: "safety-rail",
    model: "deterministic",
    input: {
      selboInstanceId: instance.id,
      decision,
      marketFeatures,
    },
    output: safetyEvent,
  });

  if (!tickId) return;
  const [tick] = await db
    .select({ context: monitorTicks.context })
    .from(monitorTicks)
    .where(eq(monitorTicks.id, tickId))
    .limit(1);
  const context = (tick?.context ?? {}) as Record<string, unknown>;
  await db.update(monitorTicks)
    .set({
      context: {
        ...context,
        safetyBlock: safetyEvent,
      },
    })
    .where(eq(monitorTicks.id, tickId));
}

/**
 * Run the Fast Trader for a Selbo instance. Fetches fresh Hyperliquid state,
 * calls the trader-tier LLM, and routes by action through the shared
 * paper-trade helpers so the open/close logic stays consistent with the
 * orchestrator's panel-execution path.
 */
export async function runFastTraderForInstance(
  instance: SelboInstance,
  watcherRationale: string,
  tickId?: string,
): Promise<FastTraderDecision> {
  const [mids, meta, clearing, lastTick] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.selboInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt))
      .limit(1)
      .then((r) => r[0]),
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
  const marketFeatures = await buildMarketFeatureSnapshot({
    watching,
    mids,
    universe: meta.universe,
    ctxs: meta.ctxs,
    previousSnapshot: previousMarketFeatures(lastTick),
  }).catch((err) => {
    console.error("[fast-trader] market feature build failed:", err);
    return {
      source: "hyperliquid-testnet" as const,
      generatedAt: new Date().toISOString(),
      symbols: [],
      skippedSymbols: watching.map((symbol) => ({
        symbol: symbol.toUpperCase(),
        reason: "feature build failed",
      })),
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

  const risk = evaluatePerpRisk({
    account: {
      equityUsd: riskNumber(clearing?.marginSummary.accountValue) ?? Number(instance.simulatedBalanceUsd),
      withdrawableUsd: riskNumber(clearing?.withdrawable) ?? Number(instance.simulatedBalanceUsd),
    },
    positions: [
      ...hlPositions.map((p) => ({
        source: "hyperliquid" as const,
        asset: p.coin.toUpperCase(),
        side: riskNumber(p.size) === null ? "unknown" as const : riskNumber(p.size)! >= 0 ? "long" as const : "short" as const,
        sizeUsd: null,
        entryPrice: riskNumber(p.entry),
        markPrice: riskNumber(mids[p.coin.toUpperCase()]),
        leverage: typeof p.leverage === "object" ? p.leverage.value : null,
        liquidationPrice: riskNumber(p.liquidation),
        unrealizedPnlUsd: riskNumber(p.unrealized_pnl),
      })),
      ...paperOpen.map((t) => {
        const asset = t.asset.toUpperCase();
        return {
          source: "paper" as const,
          asset,
          side: t.side === "short" ? "short" as const : "long" as const,
          sizeUsd: Number(t.amountUsd),
          entryPrice: t.entryPrice ? Number(t.entryPrice) : null,
          markPrice: mids[asset] ? Number(mids[asset]) : null,
        };
      }),
    ],
  });

  const payload = JSON.stringify({
    strategy: instance.strategyText,
    watcher_rationale: watcherRationale,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : { equity: instance.simulatedBalanceUsd, withdrawable: instance.simulatedBalanceUsd },
    paper_positions: paperPositions,
    hl_positions: hlPositions,
    perps,
    marketFeatures,
    risk,
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

  await logLlmCall({
    selboInstanceId: instance.id,
    tickId,
    agentName: "fast-trader",
    model: MODELS.TRADER,
    systemPrompt: FAST_TRADER_SYSTEM_PROMPT,
    userMessage: payload,
    rawResponse: raw,
    parsedOutput: decision,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  });

  const assetUpper = decision.asset.toUpperCase();
  const markPx = mids[assetUpper] ? Number(mids[assetUpper]) : null;
  const rationale = `${watcherRationale} | trader: ${decision.rationale}`;

  if (decision.action === "open_long" || decision.action === "open_short") {
    const safety = evaluateSafetyRails(decision, marketFeatures);
    if (!safety.allow) {
      await persistSafetyBlock({
        instance,
        tickId,
        decision,
        block: safety.block,
        marketFeatures,
      });
      console.warn(`[fast-trader] SAFETY BLOCK for ${instance.id}: ${safety.block.reason}`);
      return {
        ...decision,
        action: "hold",
        rationale: `${decision.rationale} | Safety rail blocked: ${safety.block.reason}`,
      };
    }

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
      agentContext: {
        payload: JSON.parse(payload),
        decision,
      } as import("@/lib/arc/anchor").AnchorJsonValue,
    });
  } else if (decision.action === "close") {
    await closePaperTrade({
      userId: instance.userId,
      selboInstanceId: instance.id,
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
