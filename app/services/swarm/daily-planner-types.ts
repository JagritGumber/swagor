import type { MarketFeatureSnapshot } from "@/lib/market-features";
import type { SentimentCounts } from "@/lib/news-sentiment";
import type { IngestionSource } from "./daily-planner-fetchers";

export type RecentPnlEntry = {
  asset: string;
  side: string;
  pnlUsd: number | null;
  pnlPct: number | null;
  closedAt: string;
};

/**
 * The exact shape the swarm + plan-compiler see. Kept in its own file
 * so consumers (LLM call audit, dev panel, tests) can import the type
 * without pulling in server-only fetchers.
 */
export type DailyPlanContext = {
  mode: "daily_plan";
  strategy: string;
  watching: string[];
  account: { equityUsd: number };
  paperPositions: Array<{ asset: string; side: string; size_usd: number; entry: number | null }>;
  perps: Array<{
    symbol: string;
    mid: string | null;
    mark: string | null;
    funding_hourly: string | null;
    open_interest: string | null;
  }>;
  marketFeatures: MarketFeatureSnapshot;
  recent_news: Array<{ title: string; source: string; hoursAgo: number | null }>;
  news_sentiment: SentimentCounts;
  recent_lessons: string[];
  recent_pnl: RecentPnlEntry[];
  yesterdayPlanSummary: { generatedAt: string; biasByAsset: unknown; notes: string } | null;
  _ingestion: IngestionSource[];
};
