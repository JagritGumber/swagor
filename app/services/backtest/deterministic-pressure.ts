import type { MarketFeatureSnapshot } from "@/lib/market-features";
import { buildTrendRegimeSnapshot } from "@/lib/trend-regime";
import type { AssetPressure, ExternalPressureSnapshot } from "@/app/services/watcher/selbo-tick-engine";

/**
 * Deterministic external-pressure snapshot for backtest replay. Live
 * trading reads real LLM-interpreted news sentiment, but a historical
 * backtest has no reproducible news archive: the live news query and
 * the temp>0 compiler produced a different `assetPressure` on every
 * run, which silently flipped trade outcomes and made two runs of the
 * same window incomparable. Here pressure is derived purely from the
 * price-based trend-regime layer, so the same window always yields the
 * same candles, the same regime, the same pressure, the same trades.
 *
 * This is honest (the regime is computed from data that genuinely
 * existed at asOf, no look-ahead) and reproducible. It encodes a plain
 * don't-fight-the-trend prior rather than fabricated headline reads.
 */
export function deterministicPressureSnapshot(marketFeatures: MarketFeatureSnapshot): ExternalPressureSnapshot {
  const trendRegime = buildTrendRegimeSnapshot(marketFeatures);
  const assetPressure: AssetPressure[] = trendRegime.assets.map((r) => {
    const confidence = r.trendStrength === "strong" ? 0.8 : r.trendStrength === "moderate" ? 0.65 : 0.5;
    if (r.trendDirection === "up") return { asset: r.asset, pressure: "bullish", confidence, reason: r.summary, source: "macro" };
    if (r.trendDirection === "down") return { asset: r.asset, pressure: "bearish", confidence, reason: r.summary, source: "macro" };
    if (r.trendDirection === "volatile") return { asset: r.asset, pressure: "risk_warning", confidence: 0.6, reason: r.summary, source: "macro" };
    return { asset: r.asset, pressure: "neutral", confidence: 0.5, reason: r.summary, source: "macro" };
  });
  return {
    generatedAt: marketFeatures.generatedAt,
    marketMood: "neutral",
    assetPressure,
    shockEvents: [],
    watcherWarnings: [],
    memoryUsed: [],
    trendRegime,
  };
}
