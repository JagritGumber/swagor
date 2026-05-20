import "server-only";

import { and, eq, ne, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trades, type Trade } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";

export const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
export const MAX_CANDLES = 5000;
export const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000,
  "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
};

export type ChartMarker = { time: number; side: "long" | "short"; isExit: boolean; tradeId: string; pnlUsd: number | null; text?: string };
export type ChartData = { candles: Array<{ t: number; o: string; h: string; l: string; c: string }>; markers: ChartMarker[]; otherAssets: string[] };

/**
 * Candles for an asset plus a user's entry/exit trade markers, shared by
 * the authed /api/chart-data route and the public per-username route.
 * Keyed by userId so the public route can pass a resolved (publicProfile)
 * user without leaking session state.
 */
export async function buildChartData(opts: { userId: string; asset: string; interval: string; lookbackMs: number }): Promise<ChartData> {
  const now = Date.now();
  const clamped = Math.min(opts.lookbackMs, INTERVAL_MS[opts.interval] * MAX_CANDLES);
  const startMs = now - clamped;

  const [rawCandles, userTrades, otherAssetRows] = await Promise.all([
    fetchCandles(opts.asset, opts.interval, startMs, now).catch(() => [] as Candle[]),
    db.select().from(trades).where(and(eq(trades.userId, opts.userId), eq(trades.asset, opts.asset))),
    db.select({ asset: trades.asset }).from(trades)
      .where(and(eq(trades.userId, opts.userId), ne(trades.asset, opts.asset), isNotNull(trades.openedAt))),
  ]);

  const candles = rawCandles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
  const markers: ChartMarker[] = userTrades.flatMap((t: Trade) => {
    const out: ChartMarker[] = [];
    const sd = t.side === "short" ? "short" : "long";
    const pnl = t.pnlUsd === null ? null : Number(t.pnlUsd);
    if (t.openedAt) out.push({ time: Math.floor(t.openedAt.getTime() / 1000), side: sd, isExit: false, tradeId: t.id, pnlUsd: pnl, text: `${sd} $${Number(t.amountUsd).toFixed(0)}` });
    if (t.closedAt) out.push({ time: Math.floor(t.closedAt.getTime() / 1000), side: sd, isExit: true, tradeId: t.id, pnlUsd: pnl, text: pnl !== null ? `close ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "close" });
    return out;
  });
  const otherAssets = Array.from(new Set(otherAssetRows.map((r) => r.asset)));

  return { candles, markers, otherAssets };
}
