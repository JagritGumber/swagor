import "server-only";

import { db } from "@/lib/db/client";
import { monitorTicks, selboInstances, equitySnapshots, trades, memoryEntries, type SelboInstance } from "@/lib/db/schema";
import { and, eq, desc, gte, or, isNull } from "drizzle-orm";
import { MODELS } from "@/lib/llm-client";
import { getCachedDailyPlan } from "@/lib/utils/daily-plan-cache";
import { runDailyPlanForInstance } from "@/app/services/swarm/daily-planner.service";
import {
  fetchAllMids,
  fetchMetaAndCtxs,
  fetchClearinghouse,
} from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { WATCHER_SYSTEM_PROMPT, type WatcherOutput } from "./prompt";
import { tierSpec, type Tier } from "@/lib/tiers";
import { evaluatePerpRisk, riskNumber } from "@/app/services/risk-engine.service";
import { anchorWatcherDecision, type AnchorJsonValue } from "@/lib/arc/anchor";
import { logLlmCall } from "@/lib/llm/log";
import { buildMarketFeatureSnapshot, type MarketFeatureSnapshot } from "@/lib/market-features";
import { detectStrategyMode } from "@/lib/strategy-mode";
import { resolveCoinUniverse } from "@/selbo.config";
import { blendWatcherCadence } from "@/lib/cadence-blend";
import { recordTickStages, type TickStageInput } from "@/app/services/tick-stages.service";
import type { SelboTickInput, WatcherExecutionState } from "./selbo-tick-types";
import { decideSelboTick } from "./selbo-agent-decision";
import { executeWatcherDecision } from "./execute-watcher-decision";

function previousMarketFeatures(lastTick: { context: unknown } | undefined): MarketFeatureSnapshot | null {
  const context = lastTick?.context as { marketFeatures?: MarketFeatureSnapshot } | null | undefined;
  return context?.marketFeatures ?? null;
}

function liveExecutionState(todayTrades: Array<{
  asset: string;
  side: string;
  pnlUsd: string | null;
  safetyTriggerReason: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
}>): WatcherExecutionState {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const cooldowns: Record<string, string> = {};
  let dailyLossCount = 0;
  let dailyRealizedPnlUsd = 0;
  for (const t of todayTrades) {
    if (!t.closedAt) continue;
    const pnl = t.pnlUsd === null ? 0 : Number(t.pnlUsd);
    if (Number.isFinite(pnl)) {
      dailyRealizedPnlUsd += pnl;
      if (pnl < 0) dailyLossCount++;
    }
    if (t.safetyTriggerReason === "stop_loss" && (t.side === "long" || t.side === "short")) {
      const until = new Date(t.closedAt.getTime() + 6 * 3_600_000);
      if (until.getTime() > now) cooldowns[`${t.asset.toUpperCase()}:${t.side}`] = until.toISOString();
    }
  }
  return {
    dailyTradeCount: todayTrades.filter((t) => t.openedAt !== null && t.openedAt >= todayStart).length,
    dailyLossCount,
    dailyRealizedPnlUsd,
    assetSideCooldownUntil: cooldowns,
  };
}

/**
 * Run one watcher tick for a given Selbo instance. Reads Hyperliquid mark
 * prices, funding rates, and the user's open positions, plus recent news,
 * then asks the watcher to classify the tick. Persists the verdict,
 * advances next_watcher_at, and on `execute` or `deliberate` routes to the
 * appropriate downstream tier.
 */
export async function runWatcherForInstance(instanceId: string): Promise<WatcherOutput> {
  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.id, instanceId)).limit(1);
  if (!instance) throw new Error(`selbo_instances ${instanceId} not found`);
  if (instance.killSwitchActive) throw new Error("kill switch active, refusing to tick");

  const strategyMode = detectStrategyMode(instance.strategyText);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Coin universe from the committed selbo.config.ts (all / include / exclude),
  // resolved against the live Hyperliquid perp list. Meta is fetched first so
  // "all"/"exclude" can see every listed coin; falls back to the instance's
  // saved watchlist if the metadata fetch fails.
  const meta = await fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] }));
  const watching = resolveCoinUniverse(meta.universe.map((u) => u.name), instance.currentlyWatching ?? ["ETH", "BTC", "SOL"]);

  const [mids, clearing, newsRes, lastTick, currentDailyPlan, openPaperTrades, todayTrades] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchClearinghouse(instance.circleWalletAddress).catch(() => null),
    searchNews(`${watching.join(" OR ")} OR "perp futures" OR "funding rate" OR cryptocurrency`)
      .catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    db.select().from(monitorTicks)
      .where(eq(monitorTicks.selboInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt)).limit(1).then((r) => r[0]),
    getCachedDailyPlan(instance.userId).catch(() => null),
    db.select().from(trades).where(and(eq(trades.userId, instance.userId), eq(trades.status, "open"))),
    db.select({
      asset: trades.asset,
      side: trades.side,
      pnlUsd: trades.pnlUsd,
      safetyTriggerReason: trades.safetyTriggerReason,
      openedAt: trades.openedAt,
      closedAt: trades.closedAt,
    }).from(trades).where(and(
      eq(trades.userId, instance.userId),
      or(gte(trades.openedAt, todayStart), gte(trades.closedAt, todayStart)),
    )),
  ]);

  // Build a per-coin perp snapshot the agent can read directly.
  const ctxByCoin = new Map(meta.universe.map((u, i) => [u.name.toUpperCase(), meta.ctxs[i]]));
  const perps = watching.map((sym) => {
    const upper = sym.toUpperCase();
    const ctx = ctxByCoin.get(upper);
    return {
      symbol: upper,
      mid: mids[upper] ?? null,
      mark: ctx?.markPx ?? null,
      funding_hourly: ctx?.funding ?? null,
      open_interest: ctx?.openInterest ?? null,
      prev_day_px: ctx?.prevDayPx ?? null,
    };
  });
  const marketFeatures = await buildMarketFeatureSnapshot({
    watching,
    mids,
    universe: meta.universe,
    ctxs: meta.ctxs,
    strategyMode,
    previousSnapshot: previousMarketFeatures(lastTick),
  }).catch((err) => {
    console.error("[watcher] market feature build failed:", err);
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

  const positions = clearing?.assetPositions.map((p) => ({
    coin: p.position.coin,
    size: p.position.szi,
    entry: p.position.entryPx,
    leverage: p.position.leverage,
    liquidation: p.position.liquidationPx,
    unrealized_pnl: p.position.unrealizedPnl,
    margin_used: p.position.marginUsed,
  })) ?? [];

  // Equity snapshot for the dashboard equity curve + balance delta. Audit
  // write; fire-and-forget so it never blocks the tick critical path.
  void db.insert(equitySnapshots).values({
    userId: instance.userId,
    selboInstanceId: instance.id,
    equityUsd: String(clearing?.marginSummary.accountValue ?? instance.simulatedBalanceUsd),
    withdrawableUsd: String(clearing?.withdrawable ?? instance.simulatedBalanceUsd),
    openPositionsCount: positions.length,
  }).catch((err) => {
    console.error("[watcher] equity snapshot insert failed:", err);
  });

  const risk = evaluatePerpRisk({
    account: {
      equityUsd: riskNumber(clearing?.marginSummary.accountValue),
      withdrawableUsd: riskNumber(clearing?.withdrawable),
    },
    positions: positions.map((p) => ({
      source: "hyperliquid",
      asset: p.coin.toUpperCase(),
      side: riskNumber(p.size) === null ? "unknown" : riskNumber(p.size)! >= 0 ? "long" : "short",
      sizeUsd: riskNumber(p.margin_used),
      entryPrice: riskNumber(p.entry),
      markPrice: riskNumber(mids[p.coin.toUpperCase()]),
      leverage: typeof p.leverage === "object" ? p.leverage.value : null,
      liquidationPrice: riskNumber(p.liquidation),
      marginUsedUsd: riskNumber(p.margin_used),
      unrealizedPnlUsd: riskNumber(p.unrealized_pnl),
    })),
  });

  const userPayload = JSON.stringify({
    strategy: instance.strategyText,
    watching,
    account: clearing
      ? { equity: clearing.marginSummary.accountValue, withdrawable: clearing.withdrawable }
      : null,
    positions,
    perps,
    marketFeatures,
    risk,
    news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
      title: n.title, source: n.source,
      hoursAgo: n.publishedAt ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000) : null,
    })),
    lastVerdict: lastTick?.verdict ?? null,
    minutesSinceLastTick: lastTick ? Math.floor((Date.now() - new Date(lastTick.createdAt).getTime()) / 60_000) : null,
    currentDailyPlan: currentDailyPlan
      ? { generatedAt: currentDailyPlan.generatedAt.toISOString(), plan: currentDailyPlan.planJson }
      : null,
  });

  let llmCallTrace:
    | {
        rawResponse: string;
        promptTokens: number | undefined;
        completionTokens: number | undefined;
        durationMs: number;
      }
    | null = null;

  const markByAsset = new Map(perps.map((p) => [p.symbol, riskNumber(p.mark ?? p.mid)]));
  const paperPositions = openPaperTrades.map((t) => ({
    asset: t.asset.toUpperCase(),
    side: t.side === "long" ? "long" as const : t.side === "short" ? "short" as const : "unknown" as const,
    entryPrice: riskNumber(t.entryPrice),
    markPrice: riskNumber(mids[t.asset.toUpperCase()]),
    sizeUsd: riskNumber(t.amountUsd),
    openedAt: t.openedAt?.toISOString() ?? null,
  }));
  // In-context learning: feed the agent lessons from its own past trades
  // (drop user-flagged-bad and deleted). This is the evolution loop.
  const lessonRows = await db.select({ lessons: memoryEntries.lessons, feedback: memoryEntries.userFeedback })
    .from(memoryEntries)
    .where(and(eq(memoryEntries.userId, instance.userId), isNull(memoryEntries.deletedAt)))
    .orderBy(desc(memoryEntries.createdAt)).limit(20);
  const recentLessons = lessonRows
    .filter((r) => r.feedback !== "bad")
    .flatMap((r) => r.lessons ?? []).slice(0, 12);

  const tickInput: SelboTickInput = {
    mode: "live",
    asOf: new Date().toISOString(),
    strategyText: instance.strategyText,
    externalSentiment: currentDailyPlan?.planJson as SelboTickInput["externalSentiment"] ?? null,
    marketFeatures,
    positions: [
      ...paperPositions,
      ...positions.map((p) => ({
        asset: p.coin.toUpperCase(),
        side: riskNumber(p.size) === null ? "unknown" as const : riskNumber(p.size)! >= 0 ? "long" as const : "short" as const,
        entryPrice: riskNumber(p.entry),
        markPrice: riskNumber(mids[p.coin.toUpperCase()]),
      })),
    ],
    risk,
    recentLessons,
    executionState: liveExecutionState(todayTrades),
  };
  const watcherDecision = await decideSelboTick(tickInput);
  const parsed: WatcherOutput = {
    verdict: watcherDecision.action === "risk_emergency"
      ? "risk_emergency"
      : watcherDecision.action === "call_swarm"
        ? "deliberate"
        : watcherDecision.action === "open_long" || watcherDecision.action === "open_short" || watcherDecision.action === "close"
          ? "execute"
          : "hold",
    rationale: watcherDecision.reason,
    nextCheckSeconds: watcherDecision.cadence.nextCheckSeconds,
    watching,
  };

  // Apply per-tier cadence plus deterministic realized-volatility blend.
  const spec = tierSpec(instance.subscriptionTier as Tier);
  const cadenceBlend = blendWatcherCadence({
    agentNextCheckSeconds: parsed.nextCheckSeconds,
    marketFeatures,
    tierMinSeconds: spec.watcherMinCadenceSeconds,
    tierMaxSeconds: spec.watcherMaxCadenceSeconds,
    riskEmergency: parsed.verdict === "risk_emergency",
  });
  const clampedNext = cadenceBlend.nextCheckSeconds;

  const [tickRow] = await db.insert(monitorTicks).values({
    selboInstanceId: instance.id,
    verdict: parsed.verdict,
    rationale: parsed.rationale,
    nextCheckSeconds: clampedNext,
    watching: parsed.watching,
    context: {
      perps,
      marketFeatures,
      risk,
      cadenceBlend,
      positionCount: positions.length,
      newsCount: (newsRes.results ?? []).length,
      tier: spec.id,
      watcherDecision,
    },
  }).returning({ id: monitorTicks.id });

  if (tickRow) {
    const routingSummary =
      parsed.verdict === "deliberate" && spec.panelDeliberations
        ? "Routing to the full swarm panel."
        : parsed.verdict === "deliberate"
          ? "Free tier downgrade: routing to the Fast Trader."
          : parsed.verdict === "execute" || parsed.verdict === "risk_emergency"
            ? "Routing to the Fast Trader."
            : "No downstream agent run needed.";
    const stageRows: TickStageInput[] = [
      {
        selboInstanceId: instance.id,
        tickId: tickRow.id,
        stage: "market_data",
        status: marketFeatures.symbols.length > 0 ? "completed" : "failed",
        summary: `${marketFeatures.symbols.length} symbols enriched; ${marketFeatures.skippedSymbols.length} skipped.`,
        metadata: { watching, skippedSymbols: marketFeatures.skippedSymbols },
      },
      {
        selboInstanceId: instance.id,
        tickId: tickRow.id,
        stage: "risk",
        status: risk.status === "critical" ? "failed" : "completed",
        summary: risk.summary,
        metadata: risk as AnchorJsonValue,
      },
      {
        selboInstanceId: instance.id,
        tickId: tickRow.id,
        stage: "watcher",
        status: "completed",
        summary: `${parsed.verdict}: ${parsed.rationale}`,
        metadata: { parsed, watcherDecision } as AnchorJsonValue,
      },
      {
        selboInstanceId: instance.id,
        tickId: tickRow.id,
        stage: "cadence_blend",
        status: "completed",
        summary: cadenceBlend.reason,
        metadata: cadenceBlend as AnchorJsonValue,
      },
      {
        selboInstanceId: instance.id,
        tickId: tickRow.id,
        stage: "routing",
        status: parsed.verdict === "hold" ? "skipped" : "pending",
        summary: routingSummary,
        metadata: { verdict: parsed.verdict, tier: spec.id },
      },
    ];
    await recordTickStages(stageRows).catch((err) => {
      console.error("[watcher] tick stage insert failed:", err);
    });
  }

  await db.update(selboInstances).set({
    nextWatcherAt: new Date(Date.now() + clampedNext * 1000),
    currentlyWatching: parsed.watching,
  }).where(eq(selboInstances.id, instance.id));

  // Log legacy watcher LLM calls if re-enabled later. The current trade
  // path is deterministic `evaluateSelboTick`; no independent watcher LLM
  // can create trades.
  if (tickRow && llmCallTrace) {
    const trace = llmCallTrace as {
      rawResponse: string;
      promptTokens: number | undefined;
      completionTokens: number | undefined;
      durationMs: number;
    };
    await logLlmCall({
      selboInstanceId: instance.id,
      tickId: tickRow.id,
      agentName: "watcher",
      model: MODELS.WATCHER,
      systemPrompt: WATCHER_SYSTEM_PROMPT,
      userMessage: userPayload,
      rawResponse: trace.rawResponse,
      parsedOutput: parsed,
      promptTokens: trace.promptTokens,
      completionTokens: trace.completionTokens,
      durationMs: trace.durationMs,
    });
  }

  // Dispatch the trading action BEFORE anchoring -- the anchor is proof of
  // a decision already made, not a gate on it. If Circle is slow, the
  // Fast Trader / cycle trigger has already kicked off; the anchor await
  // below just keeps the worker alive long enough for both to land via
  // Cloudflare's scheduled() waitUntil envelope.
  if (watcherDecision.action === "call_swarm" && spec.panelDeliberations) {
    // Daily-planning phase: deliberate now triggers a daily-plan-mode
    // cycle (watcher-triggered, rate-limited inside the orchestrator).
    // Does NOT overwrite the user-facing daily_plans row; only the
    // scheduled cron path writes that.
    void runDailyPlanForInstance(instance as SelboInstance, "watcher")
      .catch((e) => console.error("[watcher] daily-plan (watcher) failed:", e));
  } else if (watcherDecision.action === "open_long" || watcherDecision.action === "open_short" || watcherDecision.action === "close" || watcherDecision.action === "risk_emergency") {
    executeWatcherDecision({
      instance: instance as SelboInstance,
      decision: watcherDecision,
      tickInput,
      markByAsset,
    }).catch((e) => console.error("[watcher] executeWatcherDecision failed:", e));
  }

  // Arc anchor for execute / risk_emergency verdicts (M5). Runs LAST so
  // Circle latency cannot delay the trading action. `hold` is not anchored
  // (too noisy); `deliberate` is anchored downstream via the swarm cycle
  // path in orchestrator. Awaited so arcAnchorTx is saved before this
  // function returns -- on Cloudflare the cron handler's waitUntil keeps
  // the worker alive while we wait, which also lets the fire-and-forget
  // watcher-executor / cycle dispatch above run to completion.
  if (
    tickRow &&
    (parsed.verdict === "execute" || parsed.verdict === "risk_emergency")
  ) {
    const tickId = tickRow.id;
    const contextDigest: AnchorJsonValue = {
      strategy: instance.strategyText,
      perps: perps as AnchorJsonValue,
      marketFeatures: marketFeatures as AnchorJsonValue,
      risk: risk as AnchorJsonValue,
      positions: positions as AnchorJsonValue,
      watching: parsed.watching,
      tier: spec.id,
    };
    try {
      const res = await anchorWatcherDecision({
        walletId: instance.circleWalletId,
        monitorTickId: tickId,
        verdict: parsed.verdict,
        rationale: parsed.rationale,
        contextDigest,
      });
      if (res?.txId) {
        await db
          .update(monitorTicks)
          .set({ arcAnchorTx: res.txId })
          .where(eq(monitorTicks.id, tickId));
      }
    } catch (err) {
      console.error("[watcher] anchorWatcherDecision failed:", err);
    }
  }

  return parsed;
}
