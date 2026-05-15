import { NextResponse } from "next/server";
import { and, eq, ne, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { trades, type Trade } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const MAX_CANDLES = 5000;
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000,
  "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
};

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get("asset") ?? "").toUpperCase();
  const interval = searchParams.get("interval") ?? "5m";
  const lookbackMs = Number(searchParams.get("lookbackMs") ?? 86_400_000);

  if (!asset) return NextResponse.json({ error: "asset required" }, { status: 400 });
  if (!VALID_INTERVALS.has(interval)) return NextResponse.json({ error: "bad interval" }, { status: 400 });
  if (!Number.isFinite(lookbackMs) || lookbackMs <= 0) {
    return NextResponse.json({ error: "bad lookbackMs" }, { status: 400 });
  }

  const now = Date.now();
  const clamped = Math.min(lookbackMs, INTERVAL_MS[interval] * MAX_CANDLES);
  const startMs = now - clamped;

  const [rawCandles, userTrades, otherAssetRows] = await Promise.all([
    fetchCandles(asset, interval, startMs, now).catch(() => [] as Candle[]),
    db.select().from(trades).where(and(eq(trades.userId, session.user.id), eq(trades.asset, asset))),
    db.select({ asset: trades.asset })
      .from(trades)
      .where(and(eq(trades.userId, session.user.id), ne(trades.asset, asset), isNotNull(trades.openedAt))),
  ]);

  const candles = rawCandles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
  const markers = userTrades.flatMap((t: Trade) => {
    const out: {
      time: number; side: "long" | "short"; isExit: boolean;
      tradeId: string; pnlUsd: number | null; text?: string;
    }[] = [];
    const sd = t.side === "short" ? "short" : "long";
    const pnl = t.pnlUsd === null ? null : Number(t.pnlUsd);
    if (t.openedAt) out.push({
      time: Math.floor(t.openedAt.getTime() / 1000), side: sd, isExit: false,
      tradeId: t.id, pnlUsd: pnl,
      text: `${sd} $${Number(t.amountUsd).toFixed(0)}`,
    });
    if (t.closedAt) out.push({
      time: Math.floor(t.closedAt.getTime() / 1000), side: sd, isExit: true,
      tradeId: t.id, pnlUsd: pnl,
      text: pnl !== null ? `close ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "close",
    });
    return out;
  });

  const otherAssets = Array.from(new Set(otherAssetRows.map((r) => r.asset)));

  return NextResponse.json({ candles, markers, otherAssets });
}
