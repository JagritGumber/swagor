import "server-only";

import { searchNews } from "@/lib/data-sources/news";
import { classifyNews } from "@/lib/news-sentiment";
import type { SelboInstance } from "@/lib/db/schema";
import type { DailyPlanContext } from "@/app/services/swarm/daily-planner-types";
import { buildHistoricalSymbolFeatures } from "./historical-symbol-features";

/**
 * Build a DailyPlanContext as of a historical wall-clock. Candles +
 * volume profile come from Hyperliquid with the asOf endMs; OI/funding
 * snapshots are nulled because Hyperliquid only exposes point-in-time
 * values. News uses the live query, filtered to publishedAt <= asOf.
 *
 * The shape matches buildDailyPlanContext so the swarm can't tell it
 * apart, but the _ingestion array is tagged 'backtest:historical' so
 * the dev panel can label a cycle as backtest-sourced.
 */
export async function buildHistoricalContext(instance: SelboInstance, asOf: Date): Promise<DailyPlanContext> {
  const asOfMs = asOf.getTime();
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  const features = await Promise.all(watching.map((s) => buildHistoricalSymbolFeatures(s, asOfMs)));

  const newsResults = await searchNews(`${watching.join(" OR ")} OR "perp futures" OR cryptocurrency`)
    .then((r) => r.results.filter((n) => {
      const t = n.publishedAt ? Date.parse(n.publishedAt) : NaN;
      return Number.isFinite(t) && t <= asOfMs;
    }))
    .catch(() => []);

  return {
    mode: "daily_plan",
    strategy: instance.strategyText,
    watching,
    account: { equityUsd: Number(instance.simulatedBalanceUsd) },
    paperPositions: [],
    perps: features.map((f) => ({
      symbol: f.symbol,
      mid: f.mid !== null ? String(f.mid) : null,
      mark: f.mark !== null ? String(f.mark) : null,
      funding_hourly: null,
      open_interest: null,
    })),
    marketFeatures: {
      source: "hyperliquid-testnet",
      generatedAt: asOf.toISOString(),
      symbols: features,
      skippedSymbols: [],
    },
    recent_news: newsResults.slice(0, 6).map((n) => ({
      title: n.title, source: n.source,
      hoursAgo: n.publishedAt ? Math.floor((asOfMs - Date.parse(n.publishedAt)) / 3_600_000) : null,
    })),
    news_sentiment: classifyNews(newsResults),
    recent_lessons: [],
    recent_pnl: [],
    yesterdayPlanSummary: null,
    _ingestion: [{ name: "backtest:historical", status: "ok", count: features.length, latencyMs: 0 }],
  };
}
