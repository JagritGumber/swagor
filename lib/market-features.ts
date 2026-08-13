import "server-only";

import {
  fetchCandles,
  type Candle,
  type MidsMap,
  type PerpAssetCtx,
  type PerpUniverseEntry,
} from "@/lib/data-sources/hyperliquid";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildPerpMarketState, type PerpMarketState } from "@/lib/perp-market-state";
import type { StrategyMode } from "@/lib/strategy-mode";

export type FeatureQuality = "fresh" | "partial" | "stale" | "unavailable";
export type EmaTrend = "bullish" | "bearish" | "flat" | "unknown";
export type MarketRegime = "trend_up" | "trend_down" | "range" | "volatile" | "unknown";
export type CandidateBias =
  | "supports_long"
  | "supports_short"
  | "mixed"
  | "avoid_new_risk"
  | "unknown";
export type CadenceHint = "slow" | "normal" | "fast" | "risk_fast";

export type TimeframeFeature = {
  timeframe: "5m" | "1h" | "4h" | "1d";
  featureQuality: FeatureQuality;
  lastCandleAt: string | null;
  candlesUsed: number;
  missingReasons: string[];
  rsi14: number | null;
  ema20: number | null;
  ema50: number | null;
  emaTrend: EmaTrend;
  atrPct: number | null;
  realizedVolPct: number | null;
  marketRegime: MarketRegime;
};

export type SymbolMarketFeatures = {
  symbol: string;
  mid: number | null;
  mark: number | null;
  fundingHourly: number | null;
  openInterest: number | null;
  openInterestChangeHint: "rising" | "falling" | "flat" | "unknown";
  openInterestDeltas: {
    last5m: number | null;
    last1h: number | null;
    last4h: number | null;
  };
  recentCandles: Array<{
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
  timeframes: {
    "5m": TimeframeFeature;
    "1h": TimeframeFeature;
    "4h": TimeframeFeature;
    "1d": TimeframeFeature;
  };
  candidateBias: CandidateBias;
  cadenceHint: CadenceHint;
  cadenceReason: string;
  // Price levels real traders anchor on. Computed from 5m candles
  // over the recentCandles window. Null when no usable volume data.
  volumeProfile: {
    vwap: number | null;
    poc: number | null;
    vah: number | null;
    val: number | null;
    swingHigh: number | null;
    swingLow: number | null;
  };
  perpMarketState: PerpMarketState;
};

export type MarketFeatureSnapshot = {
  source: "hyperliquid-testnet";
  generatedAt: string;
  symbols: SymbolMarketFeatures[];
  skippedSymbols: Array<{ symbol: string; reason: string }>;
};

const MAX_SYMBOLS = 10;
const CANDLES_PER_TIMEFRAME = 120;
const CONCURRENCY = 3;
const FIVE_MINUTE_MS = 5 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;
const FOUR_HOUR_MS = 4 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const CACHE_TTL_MS: Record<TimeframeFeature["timeframe"], number> = {
  "5m": 90_000,
  "1h": 20 * 60_000,
  "4h": 60 * 60_000,
  "1d": 4 * 60 * 60_000,
};

const cache = new Map<string, { expiresAt: number; feature: TimeframeFeature }>();
const candleCache = new Map<string, { expiresAt: number; candles: Candle[] }>();

function finite(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export function sortFinalCandles(candles: Candle[], now = Date.now()): Candle[] {
  return candles
    .filter((c) => finite(c.c) !== null && finite(c.h) !== null && finite(c.l) !== null)
    .sort((a, b) => a.t - b.t)
    .filter((c) => c.T <= now - 1000);
}

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => Number(c.c)).filter((n) => Number.isFinite(n) && n > 0);
}

function compactCandles(candles: Candle[], count = 20): SymbolMarketFeatures["recentCandles"] {
  return sortFinalCandles(candles)
    .slice(-count)
    .map((c) => ({
      t: c.t,
      o: Number(c.o),
      h: Number(c.h),
      l: Number(c.l),
      c: Number(c.c),
      v: Number(c.v),
    }))
    .filter((c) =>
      Number.isFinite(c.o) &&
      Number.isFinite(c.h) &&
      Number.isFinite(c.l) &&
      Number.isFinite(c.c) &&
      Number.isFinite(c.v)
    );
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const seed = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  const multiplier = 2 / (period + 1);
  let out = seed;
  for (const value of values.slice(period)) {
    out = (value - out) * multiplier + out;
  }
  return out;
}

export function rsiWilder(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i]! - values[i - 1]!;
    if (delta >= 0) gain += delta;
    else loss += Math.abs(delta);
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i]! - values[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atrPct(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const ranges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    if (!current || !prev) continue;
    const high = Number(current.h);
    const low = Number(current.l);
    const prevClose = Number(prev.c);
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    if (Number.isFinite(tr)) ranges.push(tr);
  }
  if (ranges.length < period) return null;
  const recent = ranges.slice(-period);
  const atr = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle) return null;
  const lastClose = Number(lastCandle.c);
  return lastClose > 0 ? (atr / lastClose) * 100 : null;
}

export function realizedVolPct(values: number[], period = 20): number | null {
  if (values.length < period + 1) return null;
  const recent = values.slice(-(period + 1));
  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]!;
    const cur = recent[i]!;
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  if (returns.length < period) return null;
  const mean = returns.reduce((sum, v) => sum + v, 0) / returns.length;
  const variance =
    returns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

function classifyTrend(ema20: number | null, ema50: number | null, latest: number | null): EmaTrend {
  if (ema20 === null || ema50 === null || latest === null) return "unknown";
  const spreadPct = Math.abs(ema20 - ema50) / latest * 100;
  if (spreadPct < 0.05) return "flat";
  return ema20 > ema50 ? "bullish" : "bearish";
}

function classifyRegime(
  trend: EmaTrend,
  rsi: number | null,
  atr: number | null,
  vol: number | null,
): MarketRegime {
  if (trend === "unknown") return "unknown";
  if ((atr ?? 0) >= 2 || (vol ?? 0) >= 1.2) return "volatile";
  if (trend === "bullish" && (rsi ?? 50) >= 52) return "trend_up";
  if (trend === "bearish" && (rsi ?? 50) <= 48) return "trend_down";
  return "range";
}

function classifyQuality(
  candles: Candle[],
  timeframe: TimeframeFeature["timeframe"],
  missingReasons: string[],
  now = Date.now(),
): FeatureQuality {
  if (candles.length === 0) return "unavailable";
  if (missingReasons.length > 0 || candles.length < 50) return "partial";
  const last = candles[candles.length - 1];
  const staleAfter = timeframe === "5m" ? 15 * 60_000 : 3 * 60 * 60_000;
  if (!last || now - last.T > staleAfter) return "stale";
  return "fresh";
}

function buildUnknownFeature(
  timeframe: TimeframeFeature["timeframe"],
  reason: string,
): TimeframeFeature {
  return {
    timeframe,
    featureQuality: "unavailable",
    lastCandleAt: null,
    candlesUsed: 0,
    missingReasons: [reason],
    rsi14: null,
    ema20: null,
    ema50: null,
    emaTrend: "unknown",
    atrPct: null,
    realizedVolPct: null,
    marketRegime: "unknown",
  };
}

function buildFeatureFromCandles(
  timeframe: TimeframeFeature["timeframe"],
  raw: Candle[],
  missingReasons: string[] = [],
): TimeframeFeature {
  const candles = sortFinalCandles(raw);
  const cls = closes(candles);
  const latest = cls[cls.length - 1] ?? null;
  const ema20 = ema(cls, 20);
  const ema50 = ema(cls, 50);
  const rsi = rsiWilder(cls, 14);
  const atr = atrPct(candles, 14);
  const vol = realizedVolPct(cls, 20);
  const trend = classifyTrend(ema20, ema50, latest);
  const last = candles[candles.length - 1];

  const reasons = [...missingReasons];
  if (rsi === null) reasons.push("not enough candles for RSI 14");
  if (ema50 === null) reasons.push("not enough candles for EMA 50");
  if (atr === null) reasons.push("not enough candles for ATR 14");
  if (vol === null) reasons.push("not enough candles for realized volatility");

  const quality = classifyQuality(candles, timeframe, reasons);
  return {
    timeframe,
    featureQuality: quality,
    lastCandleAt: last ? new Date(last.T).toISOString() : null,
    candlesUsed: candles.length,
    missingReasons: reasons,
    rsi14: round(rsi),
    ema20: round(ema20),
    ema50: round(ema50),
    emaTrend: trend,
    atrPct: round(atr),
    realizedVolPct: round(vol, 4),
    marketRegime: classifyRegime(trend, rsi, atr, vol),
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function getTimeframeFeature(
  symbol: string,
  timeframe: TimeframeFeature["timeframe"],
): Promise<TimeframeFeature> {
  const key = `${symbol}:${timeframe}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.feature;

  const intervalMs = timeframe === "5m" ? FIVE_MINUTE_MS : timeframe === "1h" ? ONE_HOUR_MS : timeframe === "4h" ? FOUR_HOUR_MS : ONE_DAY_MS;
  try {
    const candles = await fetchCandles(
      symbol,
      timeframe,
      now - intervalMs * CANDLES_PER_TIMEFRAME,
      now,
    );
    const feature = buildFeatureFromCandles(timeframe, candles);
    cache.set(key, { expiresAt: now + CACHE_TTL_MS[timeframe], feature });
    return feature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return buildUnknownFeature(timeframe, `candle fetch failed: ${message}`);
  }
}

async function getRecentFiveMinuteCandles(symbol: string): Promise<SymbolMarketFeatures["recentCandles"]> {
  const key = `${symbol}:5m:recent`;
  const now = Date.now();
  const hit = candleCache.get(key);
  if (hit && hit.expiresAt > now) return compactCandles(hit.candles);
  try {
    const candles = await fetchCandles(
      symbol,
      "5m",
      now - FIVE_MINUTE_MS * 40,
      now,
    );
    candleCache.set(key, { expiresAt: now + CACHE_TTL_MS["5m"], candles });
    return compactCandles(candles);
  } catch {
    return [];
  }
}

function previousOi(symbol: string, previousSnapshot?: MarketFeatureSnapshot | null): {
  openInterest: number;
  generatedAt: number;
} | null {
  if (!previousSnapshot) return null;
  const row = previousSnapshot.symbols.find((s) => s.symbol === symbol);
  if (!row?.openInterest) return null;
  const generatedAt = new Date(previousSnapshot.generatedAt).getTime();
  if (!Number.isFinite(generatedAt)) return null;
  return { openInterest: row.openInterest, generatedAt };
}

function oiDeltas(opts: {
  symbol: string;
  currentOpenInterest: number | null;
  previousSnapshot?: MarketFeatureSnapshot | null;
}): SymbolMarketFeatures["openInterestDeltas"] {
  const previous = previousOi(opts.symbol, opts.previousSnapshot);
  if (!previous || opts.currentOpenInterest === null || previous.openInterest <= 0) {
    return { last5m: null, last1h: null, last4h: null };
  }
  const ageMs = Date.now() - previous.generatedAt;
  const deltaPct = (opts.currentOpenInterest - previous.openInterest) / previous.openInterest * 100;
  return {
    last5m: ageMs <= 10 * 60_000 ? round(deltaPct) : null,
    last1h: ageMs <= 70 * 60_000 ? round(deltaPct) : null,
    last4h: ageMs <= 5 * 60 * 60_000 ? round(deltaPct) : null,
  };
}

function oiHint(deltas: SymbolMarketFeatures["openInterestDeltas"]): SymbolMarketFeatures["openInterestChangeHint"] {
  const delta = deltas.last5m ?? deltas.last1h ?? deltas.last4h;
  if (delta === null) return "unknown";
  if (Math.abs(delta) < 0.1) return "flat";
  return delta > 0 ? "rising" : "falling";
}

function combineHints(features: Pick<SymbolMarketFeatures, "timeframes">): {
  candidateBias: CandidateBias;
  cadenceHint: CadenceHint;
  cadenceReason: string;
} {
  const tactical = features.timeframes["5m"];
  const regime = features.timeframes["1h"];
  const qualities = [tactical.featureQuality, regime.featureQuality];
  if (qualities.every((q) => q === "unavailable" || q === "stale")) {
    return {
      candidateBias: "unknown",
      cadenceHint: "normal",
      cadenceReason: "market features unavailable; fall back to risk and mark price",
    };
  }
  if (
    tactical.marketRegime === "volatile" ||
    regime.marketRegime === "volatile" ||
    (tactical.atrPct ?? 0) >= 2
  ) {
    return {
      candidateBias: "avoid_new_risk",
      cadenceHint: "fast",
      cadenceReason: "volatility is elevated; watch risk but avoid casual new leverage",
    };
  }
  if (tactical.emaTrend === "bullish" && regime.emaTrend === "bullish") {
    return {
      candidateBias: "supports_long",
      cadenceHint: "normal",
      cadenceReason: "short and hourly EMA trends both lean bullish",
    };
  }
  if (tactical.emaTrend === "bearish" && regime.emaTrend === "bearish") {
    return {
      candidateBias: "supports_short",
      cadenceHint: "normal",
      cadenceReason: "short and hourly EMA trends both lean bearish",
    };
  }
  if (tactical.emaTrend === "flat" && regime.emaTrend === "flat") {
    return {
      candidateBias: "mixed",
      cadenceHint: "slow",
      cadenceReason: "trend filters are flat; no clean directional setup",
    };
  }
  return {
    candidateBias: "mixed",
    cadenceHint: "normal",
    cadenceReason: "market features are mixed across timeframes",
  };
}

export async function buildMarketFeatureSnapshot(opts: {
  watching: string[];
  mids: MidsMap;
  universe: PerpUniverseEntry[];
  ctxs: PerpAssetCtx[];
  strategyMode?: StrategyMode;
  previousSnapshot?: MarketFeatureSnapshot | null;
}): Promise<MarketFeatureSnapshot> {
  const validSymbols = new Set(opts.universe.map((u) => u.name.toUpperCase()));
  const ctxBySymbol = new Map(
    opts.universe.map((u, i) => [u.name.toUpperCase(), opts.ctxs[i]]),
  );
  const deduped = Array.from(
    new Set(opts.watching.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, MAX_SYMBOLS);

  const skippedSymbols: MarketFeatureSnapshot["skippedSymbols"] = [];
  const symbols = deduped.filter((symbol) => {
    if (validSymbols.has(symbol)) return true;
    skippedSymbols.push({ symbol, reason: "not listed in Hyperliquid universe" });
    return false;
  });

  const rows = await mapConcurrent(symbols, CONCURRENCY, async (symbol) => {
    const [five, hourly, fourHour, daily, recentCandles] = await Promise.all([
      getTimeframeFeature(symbol, "5m"),
      getTimeframeFeature(symbol, "1h"),
      getTimeframeFeature(symbol, "4h"),
      getTimeframeFeature(symbol, "1d"),
      getRecentFiveMinuteCandles(symbol),
    ]);
    const ctx = ctxBySymbol.get(symbol);
    const timeframes = { "5m": five, "1h": hourly, "4h": fourHour, "1d": daily };
    const hints = combineHints({ timeframes });
    const openInterest = finite(ctx?.openInterest);
    const openInterestDeltas = oiDeltas({
      symbol,
      currentOpenInterest: openInterest,
      previousSnapshot: opts.previousSnapshot,
    });
    const vp = computeVolumeProfile(
      recentCandles,
    );
    const volumeProfile = {
      vwap: round(vp.vwap, 4),
      poc: round(vp.poc, 4),
      vah: round(vp.vah, 4),
      val: round(vp.val, 4),
      swingHigh: round(vp.swingHigh, 4),
      swingLow: round(vp.swingLow, 4),
    };
    const perpMarketState = buildPerpMarketState({
      strategyMode: opts.strategyMode,
      symbol, mid: finite(opts.mids[symbol]), fundingHourly: finite(ctx?.funding),
      openInterestChangeHint: oiHint(openInterestDeltas), openInterestDeltas,
      recentCandles, timeframes, volumeProfile,
    });
    return {
      symbol,
      mid: finite(opts.mids[symbol]),
      mark: finite(ctx?.markPx),
      fundingHourly: finite(ctx?.funding),
      openInterest,
      openInterestDeltas,
      openInterestChangeHint: oiHint(openInterestDeltas),
      recentCandles,
      timeframes,
      volumeProfile,
      perpMarketState,
      ...hints,
    };
  });

  return {
    source: "hyperliquid-testnet",
    generatedAt: new Date().toISOString(),
    symbols: rows,
    skippedSymbols,
  };
}

