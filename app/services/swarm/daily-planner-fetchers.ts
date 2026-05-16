import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, monitorTicks, trades, type DailyPlan, type SelboInstance, type Trade } from "@/lib/db/schema";
import { fetchAllMids, fetchMetaAndCtxs } from "@/lib/data-sources/hyperliquid";
import { searchNews } from "@/lib/data-sources/news";
import { getRecentLessons } from "@/app/services/memory.service";

export type IngestionSource = {
  name: string;
  status: "ok" | "empty" | "failed";
  count?: number;
  latencyMs: number;
  error?: string;
};

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  countOf?: (v: T) => number,
): Promise<{ value: T; source: IngestionSource }> {
  const start = Date.now();
  try {
    const value = await fn();
    const count = countOf?.(value);
    const status: IngestionSource["status"] = count === 0 ? "empty" : "ok";
    return { value, source: { name, status, count, latencyMs: Date.now() - start } };
  } catch (err) {
    return {
      value: fallback,
      source: { name, status: "failed", latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

type News = { results: Array<{ title: string; source: string; publishedAt: string }> };

export async function fetchAllForDailyPlan(instance: SelboInstance) {
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  const [midsR, metaR, paperOpenR, lastTickR, newsR, lessonsR, yesterdayR, closedR] = await Promise.all([
    timed("hyperliquid:mids", fetchAllMids, {} as Awaited<ReturnType<typeof fetchAllMids>>, (v) => Object.keys(v).length),
    timed("hyperliquid:meta", fetchMetaAndCtxs, { universe: [], ctxs: [] }, (v) => v.universe.length),
    timed("db:open-paper-trades",
      () => db.select().from(trades).where(and(eq(trades.userId, instance.userId), eq(trades.status, "open"))),
      [] as Trade[], (v) => v.length),
    timed("db:last-tick",
      () => db.select().from(monitorTicks).where(eq(monitorTicks.selboInstanceId, instance.id))
        .orderBy(desc(monitorTicks.createdAt)).limit(1).then((r) => r[0]),
      undefined as { context: unknown } | undefined),
    timed("news:gdelt",
      () => searchNews(`${watching.join(" OR ")} OR "perp futures" OR "funding rate" OR cryptocurrency`),
      { results: [] } as News, (v) => v.results.length),
    timed("db:lessons", () => getRecentLessons(instance.userId, 5), [] as string[], (v) => v.length),
    timed("db:yesterday-plan",
      () => db.select().from(dailyPlans).where(eq(dailyPlans.selboInstanceId, instance.id))
        .orderBy(desc(dailyPlans.generatedAt)).limit(1).then((r) => r[0]),
      undefined as DailyPlan | undefined),
    timed("db:recent-closed-trades",
      () => db.select().from(trades).where(and(
        eq(trades.userId, instance.userId), eq(trades.status, "closed"), isNotNull(trades.closedAt),
      )).orderBy(desc(trades.closedAt)).limit(10),
      [] as Trade[], (v) => v.length),
  ]);

  return {
    watching,
    mids: midsR.value, meta: metaR.value, paperOpen: paperOpenR.value, lastTick: lastTickR.value,
    newsResults: newsR.value.results, recentLessons: lessonsR.value,
    yesterdayPlan: yesterdayR.value, recentClosedTrades: closedR.value,
    ingestion: [midsR, metaR, paperOpenR, lastTickR, newsR, lessonsR, yesterdayR, closedR].map((r) => r.source),
  };
}
