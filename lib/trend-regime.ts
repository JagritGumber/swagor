import type { MarketFeatureSnapshot, SymbolMarketFeatures } from "@/lib/market-features";

export type TrendRegimeRow = {
  asset: string;
  regime: string;
  trendDirection: "up" | "down" | "range" | "volatile" | "unknown";
  trendStrength: "strong" | "moderate" | "weak" | "unknown";
  countertrendRisk: "high" | "medium" | "low" | "unknown";
  summary: string;
};

export type TrendRegimeSnapshot = {
  generatedAt: string;
  assets: TrendRegimeRow[];
};

function direction(s: SymbolMarketFeatures): TrendRegimeRow["trendDirection"] {
  if (s.perpMarketState.regime === "trend_up") return "up";
  if (s.perpMarketState.regime === "trend_down") return "down";
  if (s.perpMarketState.regime === "range" || s.perpMarketState.regime === "chop") return "range";
  if (s.perpMarketState.regime === "volatile") return "volatile";
  return "unknown";
}

function strength(s: SymbolMarketFeatures): TrendRegimeRow["trendStrength"] {
  const h1 = s.timeframes["1h"].emaTrend;
  const h4 = s.timeframes["4h"].emaTrend;
  const daily = s.timeframes["1d"].emaTrend;
  if (h1 === "unknown" || h4 === "unknown") return "unknown";
  if (h1 === h4 && h4 === daily) return "strong";
  if (h1 === h4) return "moderate";
  return "weak";
}

function countertrendRisk(dir: TrendRegimeRow["trendDirection"], str: TrendRegimeRow["trendStrength"]): TrendRegimeRow["countertrendRisk"] {
  if (dir === "up" || dir === "down") return str === "strong" || str === "moderate" ? "high" : "medium";
  if (dir === "range") return "low";
  if (dir === "volatile") return "high";
  return "unknown";
}

function summary(row: Omit<TrendRegimeRow, "summary">): string {
  if (row.trendDirection === "up") return `${row.asset} trend_up ${row.trendStrength}; countertrend shorts require bearish/risk-warning pressure.`;
  if (row.trendDirection === "down") return `${row.asset} trend_down ${row.trendStrength}; countertrend longs require bullish/risk-warning pressure.`;
  if (row.trendDirection === "volatile") return `${row.asset} volatile; require extra confirmation and smaller risk.`;
  if (row.trendDirection === "range") return `${row.asset} range; fade edges only, avoid mid-value churn.`;
  return `${row.asset} trend unknown; watcher should require clean market-structure confirmation.`;
}

export function buildTrendRegimeSnapshot(marketFeatures: MarketFeatureSnapshot): TrendRegimeSnapshot {
  return {
    generatedAt: marketFeatures.generatedAt,
    assets: marketFeatures.symbols.map((s) => {
      const base = {
        asset: s.symbol,
        regime: s.perpMarketState.regime,
        trendDirection: direction(s),
        trendStrength: strength(s),
        countertrendRisk: countertrendRisk(direction(s), strength(s)),
      };
      return { ...base, summary: summary(base) };
    }),
  };
}
