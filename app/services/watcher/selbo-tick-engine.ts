import type { MarketFeatureSnapshot, SymbolMarketFeatures } from "@/lib/market-features";
import type { RiskSnapshot } from "@/app/services/risk-engine.service";

export type AssetPressure = {
  asset: string;
  pressure: "bullish" | "bearish" | "neutral" | "risk_warning";
  confidence: number;
  reason: string;
  source?: "news" | "macro" | "regulatory" | "social" | "memory";
};

export type ExternalPressureSnapshot = {
  generatedAt?: string;
  marketMood?: "risk_on" | "risk_off" | "neutral" | "event_risk";
  assetPressure?: AssetPressure[];
  shockEvents?: Array<{
    title: string;
    affectedAssets: string[];
    impact: "bullish" | "bearish" | "risk_warning" | "ignore";
    reason: string;
  }>;
  watcherWarnings?: string[];
  memoryUsed?: string[];
};

export type PositionSnapshot = {
  asset: string;
  side: "long" | "short" | "unknown";
  entryPrice: number | null;
  markPrice: number | null;
  sizeUsd?: number | null;
};

export type CadenceDecision = {
  nextCheckSeconds: number;
  state: "dormant" | "normal_scan" | "active_watch" | "position_protection" | "event_shock";
  reason: string;
};

export type WatcherDecision = {
  action: "hold" | "open_long" | "open_short" | "close" | "call_swarm" | "risk_emergency";
  asset: string | null;
  reason: string;
  marketTrigger: "val_reclaim" | "vah_rejection" | "poc_acceptance" | "sweep_reclaim" | "range_break" | "risk_exit" | "none";
  externalPressure: "aligned" | "contradicted" | "neutral" | "unknown";
  confidence: number;
  cadence: CadenceDecision;
  sizeUsd: number;
  leverage: number;
  stopLossPriceUsd: number | null;
  takeProfitPriceUsd: number | null;
  blockedReasons: string[];
};

export type SelboTickInput = {
  mode: "live" | "backtest";
  asOf: string;
  strategyText: string;
  externalSentiment: ExternalPressureSnapshot | null;
  marketFeatures: MarketFeatureSnapshot;
  positions: PositionSnapshot[];
  risk: RiskSnapshot;
  recentLessons: string[];
};

function round(n: number): number {
  return Number(n.toFixed(3));
}

function pressureFor(input: SelboTickInput, asset: string): AssetPressure | null {
  const rows = input.externalSentiment?.assetPressure ?? [];
  return rows.find((r) => r.asset.toUpperCase() === asset.toUpperCase()) ?? null;
}

function alignment(side: "long" | "short", pressure: AssetPressure | null): WatcherDecision["externalPressure"] {
  if (!pressure) return "unknown";
  if (pressure.pressure === "neutral") return "neutral";
  if (pressure.pressure === "risk_warning") return "contradicted";
  if (side === "long" && pressure.pressure === "bullish") return "aligned";
  if (side === "short" && pressure.pressure === "bearish") return "aligned";
  return "contradicted";
}

function triggerName(symbol: SymbolMarketFeatures, side: "long" | "short"): WatcherDecision["marketTrigger"] {
  const state = symbol.perpMarketState;
  if (state.structureState === "liquidity_sweep") return "sweep_reclaim";
  if (state.structureState === "breakout" || state.structureState === "breakdown") return "range_break";
  if (side === "long" && state.auctionState === "rejected_below_value") return "val_reclaim";
  if (side === "short" && state.auctionState === "rejected_above_value") return "vah_rejection";
  if (state.valueLocation === "at_poc") return "poc_acceptance";
  return "none";
}

function cadence(input: SelboTickInput, hasCandidate: boolean): CadenceDecision {
  const hot = input.marketFeatures.symbols.some((s) => (s.timeframes["1h"].realizedVolPct ?? 0) >= 1.5);
  const shock = (input.externalSentiment?.shockEvents ?? []).some((e) => e.impact !== "ignore");
  if (input.risk.status === "critical" || input.risk.status === "urgent") {
    return { nextCheckSeconds: 120, state: "position_protection", reason: "portfolio risk requires fast checks" };
  }
  if (shock) return { nextCheckSeconds: 180, state: "event_shock", reason: "external shock event present" };
  if (hasCandidate) return { nextCheckSeconds: 180, state: "active_watch", reason: "market trigger candidate is near" };
  if (hot) return { nextCheckSeconds: 300, state: "normal_scan", reason: "realized volatility is elevated" };
  return { nextCheckSeconds: input.mode === "live" ? 900 : 3600, state: "dormant", reason: "quiet market and no clean trigger" };
}

function score(symbol: SymbolMarketFeatures, side: "long" | "short", pressure: WatcherDecision["externalPressure"]): number {
  let s = 0.58;
  const state = symbol.perpMarketState;
  if (state.dataQuality === "complete") s += 0.06;
  if (state.executionQuality === "good" || state.executionQuality === "acceptable") s += 0.04;
  if (state.setupCandidates.some((c) => c.side === side)) s += 0.08;
  if (pressure === "aligned") s += 0.06;
  if (pressure === "contradicted") s -= 0.12;
  if (state.derivativesFlow.fundingCostWarning) s -= 0.04;
  return Math.max(0, Math.min(1, s));
}

function levels(symbol: SymbolMarketFeatures, side: "long" | "short"): { stop: number | null; tp: number | null } {
  const candidate = symbol.perpMarketState.setupCandidates.find((c) => c.side === side);
  const price = symbol.mark ?? symbol.mid;
  if (!candidate || price === null) return { stop: null, tp: null };
  const stop = candidate.invalidationLevel;
  const risk = Math.abs(price - stop);
  if (!Number.isFinite(risk) || risk <= 0) return { stop: null, tp: null };
  return { stop, tp: side === "long" ? price + 2 * risk : price - 2 * risk };
}

export function evaluateSelboTick(input: SelboTickInput): WatcherDecision {
  const open = input.positions.find((p) => p.side === "long" || p.side === "short");
  if ((input.risk.status === "critical" || input.risk.status === "urgent") && open) {
    return {
      action: "risk_emergency", asset: open.asset, reason: input.risk.summary,
      marketTrigger: "risk_exit", externalPressure: "unknown", confidence: 1,
      cadence: cadence(input, false), sizeUsd: 0, leverage: 1,
      stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [],
    };
  }

  const candidates = input.marketFeatures.symbols.flatMap((symbol) => {
    const price = symbol.mark ?? symbol.mid;
    if (price === null || symbol.perpMarketState.permission === "avoid_new_risk") return [];
    if (input.positions.some((p) => p.asset.toUpperCase() === symbol.symbol.toUpperCase())) return [];
    return symbol.perpMarketState.setupCandidates.map((c) => {
      const pressure = alignment(c.side, pressureFor(input, symbol.symbol));
      const confidence = score(symbol, c.side, pressure);
      const lv = levels(symbol, c.side);
      return { symbol, side: c.side, confidence, pressure, trigger: triggerName(symbol, c.side), levels: lv };
    });
  }).sort((a, b) => b.confidence - a.confidence);

  const cd = cadence(input, candidates.length > 0);
  const best = candidates[0];
  if (!best) {
    return { action: "hold", asset: null, reason: "no inside-market trigger passed watcher filters", marketTrigger: "none", externalPressure: "unknown", confidence: 0, cadence: cd, sizeUsd: 0, leverage: 1, stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [] };
  }
  if (best.pressure === "contradicted" && best.confidence >= 0.58) {
    return { action: "call_swarm", asset: best.symbol.symbol, reason: "inside-market trigger contradicts external pressure; refresh outside-market read", marketTrigger: best.trigger, externalPressure: best.pressure, confidence: round(best.confidence), cadence: cd, sizeUsd: 0, leverage: 1, stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [] };
  }
  if (best.confidence < 0.64 || best.levels.stop === null || best.levels.tp === null) {
    return { action: "hold", asset: best.symbol.symbol, reason: "best trigger did not clear confidence or level-quality gate", marketTrigger: best.trigger, externalPressure: best.pressure, confidence: round(best.confidence), cadence: cd, sizeUsd: 0, leverage: 1, stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: ["below_trade_gate"] };
  }
  const rv = best.symbol.timeframes["1h"].realizedVolPct ?? 1;
  return {
    action: best.side === "long" ? "open_long" : "open_short",
    asset: best.symbol.symbol,
    reason: `${best.symbol.symbol} ${best.side} from ${best.trigger}; ${best.symbol.perpMarketState.brief}`,
    marketTrigger: best.trigger,
    externalPressure: best.pressure,
    confidence: round(best.confidence),
    cadence: cd,
    sizeUsd: 100,
    leverage: rv >= 1.5 ? 1 : 2,
    stopLossPriceUsd: best.levels.stop,
    takeProfitPriceUsd: best.levels.tp,
    blockedReasons: [],
  };
}
