import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { db } from "@/lib/db/client";
import { trades, type Trade } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { MarketChart, type ChartCandle, type TradeMarker } from "./market-chart";

/**
 * Server-rendered card wrapping the market chart. Fetches the last 24h of
 * 5m candles from Hyperliquid for `asset` and overlays the user's trade
 * entry/exit markers from the trades table. Empty markers list is fine —
 * the chart still renders with just the price action.
 */
export async function MarketChartCard({
  asset, userId,
}: {
  asset: string;
  userId: string;
}) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const [rawCandles, userTrades] = await Promise.all([
    fetchCandles(asset, "5m", dayAgo, now).catch(() => [] as Candle[]),
    db.select().from(trades).where(and(eq(trades.userId, userId), eq(trades.asset, asset))),
  ]);

  const candles: ChartCandle[] = rawCandles.map((c) => ({
    t: c.t, o: c.o, h: c.h, l: c.l, c: c.c,
  }));

  const markers: TradeMarker[] = userTrades.flatMap((t: Trade) => {
    const out: TradeMarker[] = [];
    const sd = (t.side === "long" || t.side === "short") ? t.side : "long";
    if (t.openedAt) {
      out.push({
        time: Math.floor(t.openedAt.getTime() / 1000),
        side: sd, isExit: false,
        text: `${sd} $${Number(t.amountUsd).toFixed(0)}`,
      });
    }
    if (t.closedAt) {
      out.push({
        time: Math.floor(t.closedAt.getTime() / 1000),
        side: sd, isExit: true,
        text: t.pnlUsd ? `close ${Number(t.pnlUsd) >= 0 ? "+" : ""}$${Number(t.pnlUsd).toFixed(2)}` : "close",
      });
    }
    return out;
  });

  if (candles.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Market
      </h2>
      <div className="mt-4">
        <MarketChart asset={asset} candles={candles} markers={markers} />
      </div>
    </section>
  );
}
