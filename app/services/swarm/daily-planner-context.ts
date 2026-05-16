import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, monitorTicks, trades, type SelboInstance } from "@/lib/db/schema";
import { fetchAllMids, fetchMetaAndCtxs } from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { buildMarketFeatureSnapshot, type MarketFeatureSnapshot } from "@/lib/market-features";
import { getRecentLessons } from "@/app/services/memory.service";

export type DailyPlanContext = {
  mode: "daily_plan";
  strategy: string;
  watching: string[];
  account: { equityUsd: number };
  paperPositions: Array<{ asset: string; side: string; size_usd: number; entry: number | null }>;
  perps: Array<{ symbol: string; mid: string | null; mark: string | null; funding_hourly: string | null; open_interest: string | null }>;
  marketFeatures: MarketFeatureSnapshot;
  recent_news: Array<{ title: string; source: string; hoursAgo: number | null }>;
  recent_lessons: string[];
  yesterdayPlanSummary: { generatedAt: string; biasByAsset: unknown; notes: string } | null;
};

function previousMarketFeatures(row: { context: unknown } | undefined): MarketFeatureSnapshot | null {
  const ctx = row?.context as { marketFeatures?: MarketFeatureSnapshot } | null | undefined;
  return ctx?.marketFeatures ?? null;
}

/**
 * Build the swarm context for a daily-plan cycle. Mirrors the orchestrator
 * pattern (mids + meta + market features + news + lessons + yesterday plan)
 * but skips clearing-house and risk-engine evaluation since the daily plan
 * is informational, not a trade order.
 */
export async function buildDailyPlanContext(instance: SelboInstance): Promise<DailyPlanContext> {
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  const [mids, meta, paperOpen, lastTick, newsRes, recentLessons, yesterdayPlan] = await Promise.all([
    fetchAllMids().catch(() => ({} as Awaited<ReturnType<typeof fetchAllMids>>)),
    fetchMetaAndCtxs().catch(() => ({ universe: [], ctxs: [] })),
    db.select().from(trades).where(and(eq(trades.userId, instance.userId), eq(trades.status, "open"))),
    db.select().from(monitorTicks).where(eq(monitorTicks.selboInstanceId, instance.id))
      .orderBy(desc(monitorTicks.createdAt)).limit(1).then((r) => r[0]),
    searchNews(`${watching.join(" OR ")} OR perp futures OR funding rate OR crypto market`)
      .catch(() => ({ results: [] as Array<{ title: string; source: string; publishedAt: string }> })),
    getRecentLessons(instance.userId, 5).catch(() => [] as string[]),
    db.select().from(dailyPlans).where(eq(dailyPlans.selboInstanceId, instance.id))
      .orderBy(desc(dailyPlans.generatedAt)).limit(1).then((r) => r[0]),
  ]);

  const ctxBySymbol = new Map(meta.universe.map((u, i) => [u.name.toUpperCase(), meta.ctxs[i]]));
  const perps = watching.map((sym) => {
    const upper = sym.toUpperCase();
    const ctx = ctxBySymbol.get(upper);
    return {
      symbol: upper,
      mid: mids[upper] ?? null,
      mark: ctx?.markPx ?? null,
      funding_hourly: ctx?.funding ?? null,
      open_interest: ctx?.openInterest ?? null,
    };
  });

  const marketFeatures = await buildMarketFeatureSnapshot({
    watching, mids, universe: meta.universe, ctxs: meta.ctxs,
    previousSnapshot: previousMarketFeatures(lastTick),
  }).catch((err) => {
    console.error("[daily-planner] market feature build failed:", err);
    return {
      source: "hyperliquid-testnet" as const,
      generatedAt: new Date().toISOString(),
      symbols: [],
      skippedSymbols: watching.map((s) => ({ symbol: s.toUpperCase(), reason: "feature build failed" })),
    };
  });

  return {
    mode: "daily_plan",
    strategy: instance.strategyText,
    watching,
    account: { equityUsd: Number(instance.simulatedBalanceUsd) },
    paperPositions: paperOpen.map((t) => ({
      asset: t.asset, side: t.side, size_usd: Number(t.amountUsd),
      entry: t.entryPrice ? Number(t.entryPrice) : null,
    })),
    perps,
    marketFeatures,
    recent_news: (newsRes.results ?? []).slice(0, 6).map((n) => ({
      title: n.title, source: n.source,
      hoursAgo: n.publishedAt ? Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000) : null,
    })),
    recent_lessons: recentLessons,
    yesterdayPlanSummary: yesterdayPlan
      ? { generatedAt: yesterdayPlan.generatedAt.toISOString(),
          biasByAsset: (yesterdayPlan.planJson as { biasByAsset?: unknown } | null)?.biasByAsset ?? null,
          notes: (yesterdayPlan.planJson as { notes?: string } | null)?.notes ?? "" }
      : null,
  };
}
