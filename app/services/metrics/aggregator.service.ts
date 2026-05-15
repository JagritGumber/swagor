import "server-only";

import { db } from "@/lib/db/client";
import {
  selboInstances, monitorTicks, trades, llmCalls,
} from "@/lib/db/schema";
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Metrics = {
  activeInstances: number;
  watcherTicks24h: number;
  riskEmergencies24h: number;
  tradesOpened24h: number;
  tradesClosed24h: number;
  paperVolume24hUsd: number;
  realizedPnlUsdLifetime: number;
  winRatePctLifetime: number | null;
  llmCalls24h: number;
  llmTokens24h: number;
  generatedAt: string;
};

/**
 * RFB 01 traction metrics. Reads ONLY from existing tables; no schema
 * change. Lifetime stats roll across the project history; 24h windows
 * use `created_at` (or `opened_at` for trades) as the cutoff.
 *
 * Heavy aggregations run in parallel via Promise.all. Each query is
 * an indexed read so the page renders sub-second for a moderate
 * dataset.
 */
export async function getMetrics(): Promise<Metrics> {
  const since = new Date(Date.now() - DAY_MS);

  const [
    activeRow,
    ticksRow,
    emergencyRow,
    openedRow,
    closedRow,
    volumeRow,
    pnlRow,
    winRateRow,
    llmCallsRow,
    llmTokensRow,
  ] = await Promise.all([
    db.select({ c: count() }).from(selboInstances)
      .where(eq(selboInstances.killSwitchActive, false)),
    db.select({ c: count() }).from(monitorTicks)
      .where(gte(monitorTicks.createdAt, since)),
    db.select({ c: count() }).from(monitorTicks)
      .where(and(eq(monitorTicks.verdict, "risk_emergency"), gte(monitorTicks.createdAt, since))),
    db.select({ c: count() }).from(trades)
      .where(and(isNotNull(trades.openedAt), gte(trades.openedAt, since))),
    db.select({ c: count() }).from(trades)
      .where(and(isNotNull(trades.closedAt), gte(trades.closedAt, since))),
    db.select({ v: sql<string>`COALESCE(SUM(${trades.amountUsd}), 0)::text` })
      .from(trades).where(and(isNotNull(trades.openedAt), gte(trades.openedAt, since))),
    db.select({ v: sql<string>`COALESCE(SUM(${trades.pnlUsd}), 0)::text` })
      .from(trades).where(and(eq(trades.status, "closed"), isNotNull(trades.pnlUsd))),
    db.select({
      total: sql<string>`COUNT(*)::text`,
      wins: sql<string>`COUNT(*) FILTER (WHERE ${trades.pnlUsd} > 0)::text`,
    }).from(trades).where(and(eq(trades.status, "closed"), isNotNull(trades.pnlUsd))),
    db.select({ c: count() }).from(llmCalls)
      .where(gte(llmCalls.createdAt, since)),
    db.select({
      v: sql<string>`COALESCE(SUM(${llmCalls.promptTokens} + ${llmCalls.completionTokens}), 0)::text`,
    }).from(llmCalls).where(gte(llmCalls.createdAt, since)),
  ]);

  const totalClosed = Number(winRateRow[0]?.total ?? "0");
  const wins = Number(winRateRow[0]?.wins ?? "0");
  const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : null;

  return {
    activeInstances: activeRow[0]?.c ?? 0,
    watcherTicks24h: ticksRow[0]?.c ?? 0,
    riskEmergencies24h: emergencyRow[0]?.c ?? 0,
    tradesOpened24h: openedRow[0]?.c ?? 0,
    tradesClosed24h: closedRow[0]?.c ?? 0,
    paperVolume24hUsd: Number(volumeRow[0]?.v ?? "0"),
    realizedPnlUsdLifetime: Number(pnlRow[0]?.v ?? "0"),
    winRatePctLifetime: winRate,
    llmCalls24h: llmCallsRow[0]?.c ?? 0,
    llmTokens24h: Number(llmTokensRow[0]?.v ?? "0"),
    generatedAt: new Date().toISOString(),
  };
}
