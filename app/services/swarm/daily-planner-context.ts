import "server-only";

import { type SelboInstance } from "@/lib/db/schema";
import { buildMarketFeatureSnapshot, type MarketFeatureSnapshot } from "@/lib/market-features";
import { classifyNews } from "@/lib/news-sentiment";
import { detectStrategyMode } from "@/lib/strategy-mode";
import { buildTrendRegimeSnapshot } from "@/lib/trend-regime";
import { fetchAllForDailyPlan } from "./daily-planner-fetchers";
import type { DailyPlanContext } from "./daily-planner-types";

export type { DailyPlanContext, RecentPnlEntry } from "./daily-planner-types";

function previousMarketFeatures(row: { context: unknown } | undefined): MarketFeatureSnapshot | null {
  const ctx = row?.context as { marketFeatures?: MarketFeatureSnapshot } | null | undefined;
  return ctx?.marketFeatures ?? null;
}

/**
 * Build the swarm context for a daily-plan cycle. Mirrors the orchestrator
 * pattern but skips clearing-house and risk-engine evaluation since the
 * daily plan is informational, not a trade order. Captures per-source
 * ingestion metadata so the dev panel can flag when a swarm reasoned on
 * an empty or failed feed.
 */
export async function buildDailyPlanContext(instance: SelboInstance): Promise<DailyPlanContext> {
  const fb = await fetchAllForDailyPlan(instance);
  const strategyMode = detectStrategyMode(instance.strategyText);

  const ctxBySymbol = new Map(fb.meta.universe.map((u, i) => [u.name.toUpperCase(), fb.meta.ctxs[i]]));
  const perps = fb.watching.map((sym) => {
    const upper = sym.toUpperCase();
    const ctx = ctxBySymbol.get(upper);
    return {
      symbol: upper,
      mid: fb.mids[upper] ?? null,
      mark: ctx?.markPx ?? null,
      funding_hourly: ctx?.funding ?? null,
      open_interest: ctx?.openInterest ?? null,
    };
  });

  const marketFeatures = await buildMarketFeatureSnapshot({
    watching: fb.watching, mids: fb.mids, universe: fb.meta.universe, ctxs: fb.meta.ctxs,
    strategyMode,
    previousSnapshot: previousMarketFeatures(fb.lastTick),
  }).catch((err) => {
    console.error("[daily-planner] market feature build failed:", err);
    return {
      source: "hyperliquid-testnet" as const,
      generatedAt: new Date().toISOString(),
      symbols: [],
      skippedSymbols: fb.watching.map((s) => ({ symbol: s.toUpperCase(), reason: "feature build failed" })),
    };
  });

  const recent_news = fb.newsResults.slice(0, 6).map((n) => ({
    title: n.title, source: n.source,
    hoursAgo: n.publishedAt ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000) : null,
  }));

  const yp = fb.yesterdayPlan;
  return {
    mode: "daily_plan",
    strategy: instance.strategyText,
    watching: fb.watching,
    account: { equityUsd: Number(instance.simulatedBalanceUsd) },
    paperPositions: fb.paperOpen.map((t) => ({
      asset: t.asset, side: t.side, size_usd: Number(t.amountUsd),
      entry: t.entryPrice ? Number(t.entryPrice) : null,
    })),
    perps,
    marketFeatures,
    trendRegime: buildTrendRegimeSnapshot(marketFeatures),
    recent_news,
    news_sentiment: classifyNews(fb.newsResults),
    recent_lessons: fb.recentLessons,
    recent_pnl: fb.recentClosedTrades.map((t) => {
      const amountUsd = Number(t.amountUsd);
      const pnlUsd = t.pnlUsd === null ? null : Number(t.pnlUsd);
      const pnlPct = pnlUsd !== null && amountUsd > 0 ? (pnlUsd / amountUsd) * 100 : null;
      return {
        asset: t.asset, side: t.side, pnlUsd, pnlPct,
        closedAt: (t.closedAt ?? new Date()).toISOString(),
      };
    }),
    yesterdayPlanSummary: yp
      ? { generatedAt: yp.generatedAt.toISOString(),
          biasByAsset: (yp.planJson as { biasByAsset?: unknown } | null)?.biasByAsset ?? null,
          notes: (yp.planJson as { notes?: string } | null)?.notes ?? "" }
      : null,
    _ingestion: fb.ingestion,
  };
}

export function externalSwarmContext(context: DailyPlanContext): object {
  return {
    mode: context.mode,
    strategy: context.strategy,
    watching: context.watching,
    recent_news: context.recent_news,
    news_sentiment: context.news_sentiment,
    recent_lessons: context.recent_lessons,
    recent_pnl: context.recent_pnl,
    trendRegime: context.trendRegime,
    yesterdayPlanSummary: context.yesterdayPlanSummary,
    _ingestion: context._ingestion,
  };
}
