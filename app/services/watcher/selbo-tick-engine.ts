import type { MarketFeatureSnapshot, SymbolMarketFeatures } from "@/lib/market-features";
import type { RiskSnapshot } from "@/app/services/risk-engine.service";
import type { PerpSetupCandidate } from "@/lib/perp-market-state";

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
  openedAt?: string | null;
};

export type WatcherExecutionState = {
  dailyTradeCount: number;
  dailyLossCount: number;
  dailyRealizedPnlUsd: number;
  assetSideCooldownUntil: Record<string, string>;
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
  executionState: WatcherExecutionState;
};

const SCALPER_MAX_OPEN_POSITIONS = 1;
const SCALPER_MAX_DAILY_TRADES = 4;
const SCALPER_MAX_DAILY_LOSSES = 2;
const SCALPER_MAX_DAILY_LOSS_USD = -15;
const SCALPER_MAX_HOLD_MS = 6 * 3_600_000;
const SCALPER_SIZE_USD = 100;
const SCALPER_LEVERAGE = 1;

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

function triggerName(candidate: PerpSetupCandidate): WatcherDecision["marketTrigger"] {
  if (candidate.setupType === "liquidity_sweep_reclaim") return "sweep_reclaim";
  if (candidate.setupType === "failed_breakout" || candidate.setupType === "value_rejection") return "vah_rejection";
  if (candidate.setupType === "failed_breakdown" || candidate.setupType === "value_reclaim") return "val_reclaim";
  if (candidate.setupType === "accepted_breakout") return "range_break";
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

function score(
  symbol: SymbolMarketFeatures,
  side: "long" | "short",
  pressure: WatcherDecision["externalPressure"],
  trigger: WatcherDecision["marketTrigger"],
  candidate: PerpSetupCandidate,
): number {
  let s = 0.38;
  const state = symbol.perpMarketState;
  if (candidate.setupType === "failed_breakout" || candidate.setupType === "failed_breakdown") s += 0.24;
  else if (candidate.setupType === "liquidity_sweep_reclaim") s += 0.2;
  else if (candidate.setupType === "value_rejection" || candidate.setupType === "value_reclaim") s += 0.16;
  else if (trigger === "range_break") s += 0.08;
  if (state.dataQuality === "complete") s += 0.05;
  if (state.executionQuality === "good") s += 0.05;
  else if (state.executionQuality === "acceptable") s += 0.03;
  if (side === "long" && (state.valueLocation === "near_val" || state.auctionState === "rejected_below_value")) s += 0.06;
  if (side === "short" && (state.valueLocation === "near_vah" || state.auctionState === "rejected_above_value")) s += 0.06;
  if (state.valueLocation === "at_poc" || state.structureState === "compression") s -= 0.08;
  if (state.regime === "chop") s -= 0.05;
  if (pressure === "aligned") s += 0.04;
  if (pressure === "contradicted") s -= 0.1;
  if (state.derivativesFlow.fundingCostWarning) s -= 0.04;
  return Math.max(0, Math.min(1, s));
}

function levels(symbol: SymbolMarketFeatures, side: "long" | "short", candidate: PerpSetupCandidate): { stop: number | null; tp: number | null } {
  const price = symbol.mark ?? symbol.mid;
  if (price === null) return { stop: null, tp: null };
  const stop = candidate.invalidationLevel;
  const risk = Math.abs(price - stop);
  if (!Number.isFinite(risk) || risk <= 0) return { stop: null, tp: null };
  if (side === "long" && stop >= price) return { stop: null, tp: null };
  if (side === "short" && stop <= price) return { stop: null, tp: null };
  return { stop, tp: side === "long" ? price + 2 * risk : price - 2 * risk };
}

function setupBlocks(symbol: SymbolMarketFeatures, candidate: PerpSetupCandidate): string[] {
  const state = symbol.perpMarketState;
  const blocks: string[] = [];
  if (candidate.permission === "wait_for_retest") blocks.push("wait_for_retest");
  if (candidate.setupType === "range_rotation") blocks.push("mid_value_no_edge");
  if (state.valueLocation === "at_poc") blocks.push("mid_value_no_edge");
  if (candidate.side === "long") {
    const valueLowReclaim = candidate.setupType === "value_reclaim"
      && (state.valueLocation === "near_val" || state.valueLocation === "below_value");
    const clean = state.auctionState === "rejected_below_value"
      || state.structureState === "failed_breakdown"
      || valueLowReclaim;
    if (!clean) blocks.push("direction_mismatch");
  } else {
    const valueHighReject = candidate.setupType === "value_rejection"
      && (state.valueLocation === "near_vah" || state.valueLocation === "above_value");
    const clean = state.auctionState === "rejected_above_value"
      || state.structureState === "failed_breakout"
      || valueHighReject;
    if (!clean) blocks.push("direction_mismatch");
  }
  return blocks;
}

function cooldownKey(asset: string, side: "long" | "short"): string {
  return `${asset.toUpperCase()}:${side}`;
}

function cooldownActive(input: SelboTickInput, asset: string, side: "long" | "short"): boolean {
  const until = input.executionState.assetSideCooldownUntil[cooldownKey(asset, side)];
  return typeof until === "string" && Date.parse(until) > Date.parse(input.asOf);
}

function staleOpen(input: SelboTickInput): PositionSnapshot | null {
  const asOf = Date.parse(input.asOf);
  return input.positions.find((p) => {
    if (p.side !== "long" && p.side !== "short") return false;
    const openedAt = p.openedAt ? Date.parse(p.openedAt) : NaN;
    return Number.isFinite(openedAt) && asOf - openedAt >= SCALPER_MAX_HOLD_MS;
  }) ?? null;
}

function profileBlocks(input: SelboTickInput): string[] {
  const blocks: string[] = [];
  const openCount = input.positions.filter((p) => p.side === "long" || p.side === "short").length;
  if (openCount >= SCALPER_MAX_OPEN_POSITIONS) blocks.push("one_position_at_a_time");
  if (input.executionState.dailyTradeCount >= SCALPER_MAX_DAILY_TRADES) blocks.push("daily_trade_cap");
  if (input.executionState.dailyLossCount >= SCALPER_MAX_DAILY_LOSSES) blocks.push("daily_loss_count_cap");
  if (input.executionState.dailyRealizedPnlUsd <= SCALPER_MAX_DAILY_LOSS_USD) blocks.push("daily_loss_usd_cap");
  return blocks;
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
  const stale = staleOpen(input);
  if (stale) {
    return {
      action: "close", asset: stale.asset, reason: "scalper time-stop: position exceeded max hold window",
      marketTrigger: "risk_exit", externalPressure: "unknown", confidence: 1,
      cadence: cadence(input, false), sizeUsd: 0, leverage: 1,
      stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: ["stale_position"],
    };
  }

  const allCandidates = input.marketFeatures.symbols.flatMap((symbol) => {
    const price = symbol.mark ?? symbol.mid;
    if (price === null || symbol.perpMarketState.permission === "avoid_new_risk") return [];
    if (symbol.perpMarketState.permission === "hedge_only") return [];
    if (input.positions.some((p) => p.asset.toUpperCase() === symbol.symbol.toUpperCase())) return [];
    return symbol.perpMarketState.setupCandidates.map((c) => {
      const pressure = alignment(c.side, pressureFor(input, symbol.symbol));
      const trigger = triggerName(c);
      const blocks = setupBlocks(symbol, c);
      const confidence = score(symbol, c.side, pressure, trigger, c);
      const lv = levels(symbol, c.side, c);
      return { symbol, side: c.side, confidence, pressure, trigger, levels: lv, blocks };
    }).filter((c) => c.trigger !== "none");
  }).sort((a, b) => b.confidence - a.confidence);
  const candidates = allCandidates.filter((c) => c.blocks.length === 0);

  const cd = cadence(input, allCandidates.length > 0);
  const best = candidates[0];
  if (!best) {
    const rejected = allCandidates[0];
    return {
      action: "hold", asset: rejected?.symbol.symbol ?? null,
      reason: rejected ? `watcher blocked ${rejected.symbol.symbol} ${rejected.side}: ${rejected.blocks.join(", ")}` : "no inside-market trigger passed watcher filters",
      marketTrigger: rejected?.trigger ?? "none",
      externalPressure: rejected?.pressure ?? "unknown",
      confidence: rejected ? round(rejected.confidence) : 0,
      cadence: cd, sizeUsd: 0, leverage: 1,
      stopLossPriceUsd: null, takeProfitPriceUsd: null,
      blockedReasons: rejected?.blocks.length ? rejected.blocks : ["no_market_trigger"],
    };
  }
  const blocks = profileBlocks(input);
  if (cooldownActive(input, best.symbol.symbol, best.side)) blocks.push("same_direction_cooldown");
  if (blocks.length > 0) {
    return {
      action: "hold", asset: best.symbol.symbol,
      reason: `watcher blocked ${best.symbol.symbol} ${best.side}: ${blocks.join(", ")}`,
      marketTrigger: best.trigger, externalPressure: best.pressure, confidence: round(best.confidence),
      cadence: cd, sizeUsd: 0, leverage: 1,
      stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: blocks,
    };
  }
  if (best.pressure === "contradicted" && best.confidence >= 0.58) {
    return { action: "call_swarm", asset: best.symbol.symbol, reason: "inside-market trigger contradicts external pressure; refresh outside-market read", marketTrigger: best.trigger, externalPressure: best.pressure, confidence: round(best.confidence), cadence: cd, sizeUsd: 0, leverage: 1, stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [] };
  }
  if (best.confidence < 0.64 || best.levels.stop === null || best.levels.tp === null) {
    return { action: "hold", asset: best.symbol.symbol, reason: "best trigger did not clear confidence or level-quality gate", marketTrigger: best.trigger, externalPressure: best.pressure, confidence: round(best.confidence), cadence: cd, sizeUsd: 0, leverage: 1, stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: ["below_trade_gate"] };
  }
  return {
    action: best.side === "long" ? "open_long" : "open_short",
    asset: best.symbol.symbol,
    reason: `${best.symbol.symbol} ${best.side} from ${best.trigger}; ${best.symbol.perpMarketState.brief}`,
    marketTrigger: best.trigger,
    externalPressure: best.pressure,
    confidence: round(best.confidence),
    cadence: cd,
    sizeUsd: SCALPER_SIZE_USD,
    leverage: SCALPER_LEVERAGE,
    stopLossPriceUsd: best.levels.stop,
    takeProfitPriceUsd: best.levels.tp,
    blockedReasons: [],
  };
}
