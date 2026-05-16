import "server-only";

import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { atrPct, closes, ema, realizedVolPct, rsiWilder, sortFinalCandles } from "@/lib/market-features";

const CANDLES = 120;
type Tf = { interval: "5m" | "1h"; spanMs: number };
const TFS: Tf[] = [
  { interval: "5m", spanMs: 5 * 60_000 },
  { interval: "1h", spanMs: 60 * 60_000 },
];

async function fetchTimeframe(symbol: string, tf: Tf, asOfMs: number): Promise<Candle[]> {
  const startMs = asOfMs - CANDLES * tf.spanMs;
  return fetchCandles(symbol, tf.interval, startMs, asOfMs).then((c) => sortFinalCandles(c, asOfMs));
}

function trendOf(e20: number | null, e50: number | null): "bullish" | "bearish" | "flat" | "unknown" {
  if (e20 === null || e50 === null) return "unknown";
  const spread = (e20 - e50) / e50;
  if (Math.abs(spread) < 0.0015) return "flat";
  return spread > 0 ? "bullish" : "bearish";
}

/**
 * Build a single symbol's historical feature row for backtest. Same
 * shape the live market-features pipeline emits; OI fields nulled
 * because Hyperliquid only exposes point-in-time OI.
 */
export async function buildHistoricalSymbolFeatures(symbol: string, asOfMs: number) {
  const sym = symbol.toUpperCase();
  const [c5, c1h] = await Promise.all(TFS.map((tf) => fetchTimeframe(sym, tf, asOfMs)));
  const recentCandles = c5.slice(-20).map((c) => ({
    t: c.t, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v),
  }));
  const closes5 = closes(c5);
  const closes1h = closes(c1h);
  const vp = computeVolumeProfile(recentCandles);
  const lastClose = closes5[closes5.length - 1] ?? null;
  return {
    symbol: sym, mid: lastClose, mark: lastClose,
    fundingHourly: null, openInterest: null,
    openInterestDeltas: { last5m: null, last1h: null, last4h: null },
    openInterestChangeHint: "unknown" as const,
    recentCandles,
    timeframes: {
      "5m": {
        timeframe: "5m" as const, featureQuality: "fresh" as const, lastCandleAt: null,
        candlesUsed: closes5.length, missingReasons: [] as string[],
        rsi14: rsiWilder(closes5), ema20: ema(closes5, 20), ema50: ema(closes5, 50),
        emaTrend: trendOf(ema(closes5, 20), ema(closes5, 50)),
        atrPct: atrPct(c5), realizedVolPct: realizedVolPct(closes5),
        marketRegime: "unknown" as const,
      },
      "1h": {
        timeframe: "1h" as const, featureQuality: "fresh" as const, lastCandleAt: null,
        candlesUsed: closes1h.length, missingReasons: [] as string[],
        rsi14: rsiWilder(closes1h), ema20: ema(closes1h, 20), ema50: ema(closes1h, 50),
        emaTrend: trendOf(ema(closes1h, 20), ema(closes1h, 50)),
        atrPct: atrPct(c1h), realizedVolPct: realizedVolPct(closes1h),
        marketRegime: "unknown" as const,
      },
    },
    volumeProfile: {
      vwap: vp.vwap, poc: vp.poc, vah: vp.vah, val: vp.val,
      swingHigh: vp.swingHigh, swingLow: vp.swingLow,
    },
    candidateBias: "unknown" as const,
    cadenceHint: "normal" as const, cadenceReason: "backtest",
  };
}
