import { stopTpForSide, computePnl, type OpenPos } from "./simulate-helpers";
import { notionalForConfidence, type StrategyPolicy } from "./strategy-policy";
import type { StrategyMode } from "@/lib/strategy-mode";
import { evaluateTradeQuality, type TradeQualityReport } from "@/app/services/trade-quality-engine";

export type BacktestCloseEvent = { asset: string; pos: OpenPos; exitDate: Date; exitPrice: number; reason: string };

export type OpenCandidate = {
  b: { asset: string; confidence: number; reason?: string; invalidatesIf?: string | null; realizedVolPct1h?: number; stopLossPct?: number; takeProfitPct?: number; setupType?: string; strategyMode?: StrategyMode; invalidationSource?: string | null };
  price: number; side: "long" | "short";
};

/** Vol-scaled stop/TP. Engine math; LLM doesn't touch this. */
export function deterministicRiskPct(vol: number | undefined): { stopPct: number; tpPct: number } {
  if (vol === undefined) return { stopPct: 4, tpPct: 8 };
  const stopPct = Math.min(7, Math.max(3, 1.5 * vol));
  return { stopPct, tpPct: 2 * stopPct };
}

/** Clamp a model-supplied advisory value within +/- 20% of the deterministic compute. */
export function clampOverride(model: number | undefined, deterministic: number): number {
  if (model === undefined) return deterministic;
  return Math.max(deterministic * 0.8, Math.min(deterministic * 1.2, model));
}

function numericInvalidation(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function openPosition(asset: string, side: "long" | "short", price: number, dayMs: number, equity: number, notionalPct: number, leverage: number, confidence: number, reason: string, invalidatesIf: string | null, stopPct: number, tpPct: number, strategyMode: StrategyMode = "swing", setupType?: string, invalidationSource?: string | null, qualityReport?: TradeQualityReport | null): OpenPos {
  const { stop, tp } = stopTpForSide(side, price, stopPct, tpPct);
  const entryDate = new Date(dayMs);
  return {
    side, entryDate, entryPrice: price, sizeUsd: equity * notionalPct / 100,
    leverage, confidence, stopPrice: stop, tpPrice: tp,
    thesisId: `${asset}:${entryDate.toISOString()}:${side}`, entryReason: reason, invalidatesIf,
    strategyMode, setupType: setupType ?? null, invalidationSource: invalidationSource ?? null,
    invalidationLevel: qualityReport?.invalidationLevel ?? numericInvalidation(invalidatesIf),
    llmConfidence: qualityReport?.llmConfidence ?? confidence, qualityReport: qualityReport ?? null,
  };
}

/**
 * Partial harvest. Closes half the position at today's close, tightens
 * the remaining stop to break-even. Guarded: only executes when the
 * position's current unrealized % is at least 75% of its TP target.
 * Otherwise logs and skips so the model can't randomly profit-take at
 * break-even noise.
 */
export function tryReduce(asset: string, pos: OpenPos, price: number, dayMs: number, equity: number, closes: BacktestCloseEvent[], generatedAt: Date): number {
  const unrealizedPct = pos.side === "long" ? (price - pos.entryPrice) / pos.entryPrice * 100 : (pos.entryPrice - price) / pos.entryPrice * 100;
  const tpTargetPct = Math.abs((pos.tpPrice - pos.entryPrice) / pos.entryPrice * 100);
  if (unrealizedPct < 0.75 * tpTargetPct) {
    console.warn(`[backtest-sim] reduce ignored on ${asset} ${generatedAt.toISOString()}: unrealizedPct=${unrealizedPct.toFixed(2)}% below 75% of TP target ${tpTargetPct.toFixed(2)}%`);
    return equity;
  }
  const halfSize = pos.sizeUsd / 2;
  const { pnlUsd } = computePnl(pos.side, pos.entryPrice, price, halfSize, pos.leverage);
  closes.push({ asset, pos: { ...pos, sizeUsd: halfSize }, exitDate: new Date(dayMs), exitPrice: price, reason: "thesis_reduced" });
  pos.sizeUsd = halfSize;
  pos.stopPrice = pos.entryPrice;
  return equity + pnlUsd;
}

/**
 * Selectivity gate. Max one bias-driven new thesis per cycle: the
 * highest-confidence candidate opens; the rest are logged and skipped.
 * Sizing (notional %, leverage) comes from the policy; the swarm's
 * `riskCaps` are ignored entirely. Flips from thesis reviews go
 * through their own path in the caller and are not capped here.
 */
export function openTopCandidate(candidates: OpenCandidate[], policy: StrategyPolicy, dayMs: number, equity: number, positions: Map<string, OpenPos>, opens: Array<{ asset: string; pos: OpenPos }>): void {
  if (candidates.length === 0) return;
  const scored = candidates.map((c) => ({
    candidate: c,
    quality: evaluateTradeQuality({
      asset: c.b.asset, side: c.side, entryPrice: c.price, llmConfidence: c.b.confidence,
      setupType: c.b.setupType, invalidationSource: c.b.invalidationSource,
      invalidationLevel: numericInvalidation(c.b.invalidatesIf),
      realizedVolPct1h: c.b.realizedVolPct1h, reason: c.b.reason,
    }),
  })).sort((a, b) => b.quality.engineConfidence - a.quality.engineConfidence);
  for (const s of scored.filter((x) => x.quality.capitalGate !== "ALLOW_PAPER")) {
    console.warn(`[backtest-sim] quality block ${s.candidate.b.asset} ${s.candidate.side}: gate=${s.quality.capitalGate} reasons=${s.quality.rejectReasons.join(",")}`);
  }
  const selected = scored.find((s) => s.quality.capitalGate === "ALLOW_PAPER");
  if (!selected) return;
  if (scored.length > 1) {
    const skipped = scored.filter((s) => s !== selected).map((s) => `${s.candidate.b.asset}(${s.quality.engineConfidence.toFixed(2)}/${s.quality.capitalGate})`).join(", ");
    console.info(`[backtest-sim] cap=1 selected ${selected.candidate.b.asset}, skipped ${skipped}`);
  }
  const top = selected.candidate;
  const quality = selected.quality;
  const det = deterministicRiskPct(top.b.realizedVolPct1h);
  const stopPct = clampOverride(top.b.stopLossPct, det.stopPct);
  const tpPct = clampOverride(top.b.takeProfitPct, det.tpPct);
  const asset = top.b.asset.toUpperCase();
  const notionalPct = notionalForConfidence(policy, quality.engineConfidence);
  const newPos = openPosition(asset, top.side, top.price, dayMs, equity, notionalPct, policy.maxLeverage, quality.engineConfidence, top.b.reason ?? "", top.b.invalidatesIf ?? null, stopPct, tpPct, top.b.strategyMode ?? "swing", top.b.setupType, top.b.invalidationSource, quality);
  positions.set(asset, newPos);
  opens.push({ asset, pos: newPos });
}
