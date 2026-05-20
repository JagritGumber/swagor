import type { StrategyMode } from "@/lib/strategy-mode";

export type CompactCandle = { o: number; h: number; l: number; c: number; v: number };
export type PerpPermission = "allow_long" | "allow_short" | "hedge_only" | "wait_for_retest" | "avoid_new_risk";
export type SetupType = "value_reclaim" | "value_rejection" | "accepted_breakout" | "failed_breakout" | "failed_breakdown" | "liquidity_sweep_reclaim" | "trend_pullback_to_value" | "range_rotation" | "crowded_side_fade";

export type PerpSetupCandidate = {
  symbol: string; side: "long" | "short"; setupType: SetupType; permission: PerpPermission;
  entryLogic: string; invalidationLevel: number; invalidationSource: "vwap" | "poc" | "vah" | "val" | "range_high" | "range_low" | "swing_high" | "swing_low" | "funding_oi_shift";
  confirmation: string; rejectionReason?: string;
};
export type PerpMarketState = {
  symbol: string; dataQuality: "complete" | "partial" | "degraded";
  regime: "trend_up" | "trend_down" | "range" | "chop" | "volatile" | "event_risk" | "unknown";
  valueLocation: "below_value" | "inside_value" | "above_value" | "at_poc" | "near_vah" | "near_val" | "unknown";
  auctionState: "accepted_above_value" | "accepted_below_value" | "rejected_above_value" | "rejected_below_value" | "value_rotation" | "unknown";
  structureState: "breakout" | "breakdown" | "failed_breakout" | "failed_breakdown" | "liquidity_sweep" | "compression" | "expansion" | "unknown";
  levels: { vwap: number | null; poc: number | null; vah: number | null; val: number | null; rangeHigh: number | null; rangeLow: number | null; swingHigh: number | null; swingLow: number | null };
  derivativesFlow: { fundingState: "positive" | "negative" | "extreme_positive" | "extreme_negative" | "neutral" | "unknown"; oiState: "rising" | "falling" | "flat" | "unknown"; flowRead: "long_building" | "short_building" | "short_covering" | "long_capitulation" | "churn" | "unknown"; fundingCostWarning: boolean };
  liquidity: { spreadRisk: "low" | "medium" | "high" | "unknown"; bookImbalance: "bid_heavy" | "ask_heavy" | "balanced" | "unknown"; liquidationClusterBias: "above" | "below" | "both" | "none" | "unknown" };
  strategyMode: StrategyMode; executionQuality: "good" | "acceptable" | "poor" | "unknown";
  permission: PerpPermission; setupCandidates: PerpSetupCandidate[]; helperContext: string; brief: string;
};
type Input = {
  strategyMode?: StrategyMode;
  symbol: string; mid: number | null; fundingHourly: number | null; openInterestChangeHint: "rising" | "falling" | "flat" | "unknown";
  openInterestDeltas: { last5m: number | null; last1h: number | null; last4h: number | null };
  recentCandles: CompactCandle[]; timeframes: Record<string, { marketRegime?: string; emaTrend?: string; atrPct?: number | null; realizedVolPct?: number | null } | undefined>;
  volumeProfile: { vwap: number | null; poc: number | null; vah: number | null; val: number | null; swingHigh: number | null; swingLow: number | null };
};
function pct(a: number, b: number): number { return b === 0 ? 0 : (a - b) / b * 100; }
function near(price: number, level: number | null, tolerancePct: number): boolean { return level !== null && Math.abs(pct(price, level)) <= tolerancePct; }
function lastN(candles: CompactCandle[], n: number): CompactCandle[] { return candles.slice(Math.max(0, candles.length - n)); }

export function buildPerpMarketState(input: Input): PerpMarketState {
  const strategyMode = input.strategyMode ?? "swing";
  const candles = input.recentCandles.filter((c) => Number.isFinite(c.c) && Number.isFinite(c.h) && Number.isFinite(c.l));
  const last = candles[candles.length - 1];
  const price = input.mid ?? last?.c ?? null;
  const vp = input.volumeProfile;
  const atr = input.timeframes["1h"]?.atrPct ?? input.timeframes["5m"]?.atrPct ?? null;
  const tolerance = Math.max(0.12, Math.min(0.5, (atr ?? 0.5) * 0.25));
  const rangeHigh = candles.length ? Math.max(...lastN(candles, 20).map((c) => c.h)) : null;
  const rangeLow = candles.length ? Math.min(...lastN(candles, 20).map((c) => c.l)) : null;
  const levels = { vwap: vp.vwap, poc: vp.poc, vah: vp.vah, val: vp.val, rangeHigh, rangeLow, swingHigh: vp.swingHigh, swingLow: vp.swingLow };
  const qualities = Object.values(input.timeframes).map((t) => t?.marketRegime ?? "unknown");
  const hasProfile = vp.vah !== null && vp.val !== null && vp.vwap !== null && vp.poc !== null;
  const minCandles = strategyMode === "scalper" ? 4 : 10;
  const dataQuality = price === null || candles.length < minCandles || !hasProfile ? "degraded" : qualities.includes("unknown") ? "partial" : "complete";
  const regime = classifyRegime(input, atr);
  const valueLocation = price === null ? "unknown" : near(price, vp.poc, tolerance) ? "at_poc" : near(price, vp.vah, tolerance) ? "near_vah" : near(price, vp.val, tolerance) ? "near_val" : vp.vah !== null && price > vp.vah ? "above_value" : vp.val !== null && price < vp.val ? "below_value" : vp.vah !== null && vp.val !== null ? "inside_value" : "unknown";
  const auctionState = classifyAuction(price, candles, vp);
  const structureState = classifyStructure(price, candles, rangeHigh, rangeLow, auctionState);
  const derivativesFlow = classifyFlow(input, candles);
  const permission = choosePermission({ strategyMode, dataQuality, regime, valueLocation, auctionState, structureState, flow: derivativesFlow.flowRead });
  const executionQuality = classifyExecution(strategyMode, candles, atr);
  const setupCandidates = price === null ? [] : candidates(strategyMode, input.symbol, permission, auctionState, structureState, valueLocation, levels, derivativesFlow.flowRead);
  return {
    symbol: input.symbol, dataQuality, regime, valueLocation, auctionState, structureState, levels, derivativesFlow,
    liquidity: { spreadRisk: "unknown", bookImbalance: "unknown", liquidationClusterBias: "unknown" },
    strategyMode, executionQuality, permission, setupCandidates,
    helperContext: `EMA/RSI are helper context only; do not use them as the primary trade reason.`,
    brief: `${input.symbol}: ${regime}, ${valueLocation}, ${auctionState}, ${structureState}, ${derivativesFlow.flowRead}; permission=${permission}.`,
  };
}

function classifyRegime(input: Input, atr: number | null): PerpMarketState["regime"] {
  const h4 = input.timeframes["4h"]?.emaTrend;
  const h1 = input.timeframes["1h"]?.emaTrend;
  if ((atr ?? 0) >= 2.5) return "volatile";
  if (h4 === "bullish" && h1 === "bullish") return "trend_up";
  if (h4 === "bearish" && h1 === "bearish") return "trend_down";
  if (h1 === "flat") return "range";
  return "chop";
}
function classifyAuction(price: number | null, candles: CompactCandle[], vp: Input["volumeProfile"]): PerpMarketState["auctionState"] {
  if (price === null || vp.vah === null || vp.val === null) return "unknown";
  const recent = lastN(candles, 3);
  const vah = vp.vah;
  const val = vp.val;
  if (recent.length >= 2 && recent.every((c) => c.c > vah)) return "accepted_above_value";
  if (recent.length >= 2 && recent.every((c) => c.c < val)) return "accepted_below_value";
  if (recent.some((c) => c.h > vah) && price <= vah) return "rejected_above_value";
  if (recent.some((c) => c.l < val) && price >= val) return "rejected_below_value";
  return "value_rotation";
}
function classifyStructure(price: number | null, candles: CompactCandle[], hi: number | null, lo: number | null, auction: PerpMarketState["auctionState"]): PerpMarketState["structureState"] {
  if (price === null || hi === null || lo === null) return "unknown";
  const prev = candles.slice(-6, -1);
  if (prev.some((c) => c.h >= hi) && price < hi && auction === "rejected_above_value") return "failed_breakout";
  if (prev.some((c) => c.l <= lo) && price > lo && auction === "rejected_below_value") return "failed_breakdown";
  if (price > hi) return "breakout";
  if (price < lo) return "breakdown";
  if (auction === "rejected_above_value" || auction === "rejected_below_value") return "liquidity_sweep";
  return "compression";
}
function classifyFlow(input: Input, candles: CompactCandle[]): PerpMarketState["derivativesFlow"] {
  const funding = input.fundingHourly;
  const fundingState = funding === null ? "unknown" : funding > 0.0003 ? "extreme_positive" : funding < -0.0003 ? "extreme_negative" : funding > 0 ? "positive" : funding < 0 ? "negative" : "neutral";
  const oiState = input.openInterestChangeHint;
  const first = candles[0]; const last = candles[candles.length - 1];
  const move = first && last ? pct(last.c, first.c) : 0;
  const flowRead = oiState === "rising" && move > 0 ? "long_building" : oiState === "rising" && move < 0 ? "short_building" : oiState === "falling" && move > 0 ? "short_covering" : oiState === "falling" && move < 0 ? "long_capitulation" : oiState === "flat" ? "churn" : "unknown";
  return { fundingState, oiState, flowRead, fundingCostWarning: fundingState === "extreme_positive" || fundingState === "extreme_negative" };
}
function classifyExecution(strategyMode: StrategyMode, candles: CompactCandle[], atr: number | null): PerpMarketState["executionQuality"] {
  if (candles.length < 4) return "unknown";
  const last = candles[candles.length - 1];
  if (!last || last.c <= 0) return "unknown";
  const lastRangePct = (last.h - last.l) / last.c * 100;
  if (strategyMode === "scalper" && lastRangePct > Math.max(1.2, (atr ?? 0.8) * 1.8)) return "poor";
  return last.v > 0 ? "acceptable" : "unknown";
}

function choosePermission(s: Pick<PerpMarketState, "strategyMode" | "dataQuality" | "regime" | "valueLocation" | "auctionState" | "structureState"> & { flow: PerpMarketState["derivativesFlow"]["flowRead"] }): PerpPermission {
  if (s.dataQuality === "degraded") return "avoid_new_risk";
  if (s.regime === "volatile" && s.strategyMode !== "scalper") return "avoid_new_risk";
  if (s.regime === "volatile" && s.strategyMode === "scalper") return "wait_for_retest";
  if (s.strategyMode === "scalper") {
    if (s.auctionState === "accepted_above_value" || s.auctionState === "rejected_below_value" || s.structureState === "failed_breakdown" || s.valueLocation === "near_val") return "allow_long";
    if (s.auctionState === "accepted_below_value" || s.auctionState === "rejected_above_value" || s.structureState === "failed_breakout" || s.valueLocation === "near_vah") return "allow_short";
    if (s.valueLocation === "inside_value" || s.valueLocation === "at_poc") return "wait_for_retest";
  }
  if (s.auctionState === "accepted_above_value" || s.auctionState === "rejected_below_value" || s.structureState === "failed_breakdown") return "allow_long";
  if (s.auctionState === "accepted_below_value" || s.auctionState === "rejected_above_value" || s.structureState === "failed_breakout") return "allow_short";
  if (s.valueLocation === "at_poc" || s.valueLocation === "inside_value") return "wait_for_retest";
  return "hedge_only";
}
function candidates(strategyMode: StrategyMode, symbol: string, permission: PerpPermission, auction: PerpMarketState["auctionState"], structure: PerpMarketState["structureState"], location: PerpMarketState["valueLocation"], l: PerpMarketState["levels"], flow: PerpMarketState["derivativesFlow"]["flowRead"]): PerpSetupCandidate[] {
  const out: PerpSetupCandidate[] = [];
  if (strategyMode === "scalper" && permission === "wait_for_retest") {
    if ((location === "near_val" || location === "inside_value") && l.val !== null) out.push({ symbol, side: "long", setupType: "range_rotation", permission, entryLogic: `Scalper long only near value low/reclaim; location=${location}, flow=${flow}.`, invalidationLevel: l.val, invalidationSource: "val", confirmation: "Needs value-low hold or reclaim; exit quickly if no rotation." });
    if ((location === "near_vah" || location === "inside_value") && l.vah !== null) out.push({ symbol, side: "short", setupType: "range_rotation", permission, entryLogic: `Scalper short only near value high/rejection; location=${location}, flow=${flow}.`, invalidationLevel: l.vah, invalidationSource: "vah", confirmation: "Needs value-high rejection; exit quickly if no rotation." });
  }
  if ((permission === "allow_long" || permission === "hedge_only") && l.val !== null) out.push({ symbol, side: "long", setupType: structure === "failed_breakdown" || auction === "rejected_below_value" ? "liquidity_sweep_reclaim" : "value_reclaim", permission, entryLogic: `Long only after acceptance/reclaim above value; location=${location}, flow=${flow}.`, invalidationLevel: l.val, invalidationSource: "val", confirmation: "Needs hold above VAL/VWAP and no short-building OI contradiction." });
  if ((permission === "allow_short" || permission === "hedge_only") && l.vah !== null) out.push({ symbol, side: "short", setupType: structure === "failed_breakout" || auction === "rejected_above_value" ? "failed_breakout" : "value_rejection", permission, entryLogic: `Short only after rejection/failure at value high; location=${location}, flow=${flow}.`, invalidationLevel: l.vah, invalidationSource: "vah", confirmation: "Needs failure below VAH/VWAP and no long-building OI contradiction." });
  return out;
}
