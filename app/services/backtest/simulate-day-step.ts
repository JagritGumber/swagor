import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { DailyPlan } from "@/lib/db/schema";
import { candleAt, checkStopTpHit, closeAt, computePnl, type OpenPos, stopTpForSide, utcDayMs } from "./simulate-helpers";

type BiasEntry = { asset: string; bias: string; confidence: number; reason?: string; invalidatesIf?: string | null; flipsTo?: string | null };
type ThesisReviewJson = { thesisId: string; asset: string; decision: "maintain" | "reduce" | "close" | "flip"; flipTo: "long" | "short" | "avoid" | "neutral" | null; reason: string };
type PlanJson = { biasByAsset?: BiasEntry[]; riskCaps?: { maxLeverage?: number; maxNotionalPctOfEquity?: number }; activeThesisReviews?: ThesisReviewJson[] };
export type BacktestCloseEvent = { asset: string; pos: OpenPos; exitDate: Date; exitPrice: number; reason: string };
export type BacktestOpenEvent = { asset: string; pos: OpenPos };
export type BacktestDayResult = { closes: BacktestCloseEvent[]; opens: BacktestOpenEvent[]; newEquity: number };

function openPosition(asset: string, side: "long" | "short", price: number, dayMs: number, equity: number, notionalPct: number, leverage: number, confidence: number, reason: string, invalidatesIf: string | null): OpenPos {
  const { stop, tp } = stopTpForSide(side, price);
  const entryDate = new Date(dayMs);
  return {
    side, entryDate, entryPrice: price, sizeUsd: equity * notionalPct / 100,
    leverage, confidence, stopPrice: stop, tpPrice: tp,
    thesisId: `${asset}:${entryDate.toISOString()}:${side}`,
    entryReason: reason, invalidatesIf,
  };
}

function closePosition(asset: string, pos: OpenPos, exitPrice: number, dayMs: number, reason: string, equity: number, closes: BacktestCloseEvent[]): number {
  const { pnlUsd } = computePnl(pos.side, pos.entryPrice, exitPrice, pos.sizeUsd, pos.leverage);
  closes.push({ asset, pos, exitDate: new Date(dayMs), exitPrice, reason });
  return equity + pnlUsd;
}

/** Pure per-day step shared by the actual simulator and the thesis-memory replay helper. Order: stops/TPs, then thesis reviews (or legacy bias-flip closes for pre-thesis plans), then opens for assets without an active position. */
export function simulateOneBacktestDay(input: { plan: DailyPlan; positions: Map<string, OpenPos>; candleCache: Map<string, Candle[]>; equity: number }): BacktestDayResult {
  const dayMs = utcDayMs(input.plan.generatedAt);
  let equity = input.equity;
  const closes: BacktestCloseEvent[] = [];
  const opens: BacktestOpenEvent[] = [];

  for (const [asset, pos] of [...input.positions]) {
    const candle = (input.candleCache.get(asset) && candleAt(input.candleCache.get(asset)!, dayMs)) || null;
    if (!candle) continue;
    const hit = checkStopTpHit(pos, candle);
    if (!hit) continue;
    equity = closePosition(asset, pos, hit.price, dayMs, hit.reason, equity, closes);
    input.positions.delete(asset);
  }

  if (input.plan.status !== "complete") return { closes, opens, newEquity: equity };
  const json = input.plan.planJson as PlanJson | null;
  if (!json) return { closes, opens, newEquity: equity };
  const notionalPct = json.riskCaps?.maxNotionalPctOfEquity ?? 15;
  const leverage = Math.max(1, json.riskCaps?.maxLeverage ?? 1);
  const reviews = json.activeThesisReviews;

  const reviewedAssets = new Set((reviews ?? []).map((r) => r.asset.toUpperCase()));

  if (reviews !== undefined) {
    for (const r of reviews) {
      if (r.decision === "maintain" || r.decision === "reduce") continue;
      const asset = r.asset.toUpperCase();
      const pos = input.positions.get(asset);
      if (!pos || pos.thesisId !== r.thesisId) { console.warn(`[backtest-sim] hallucinated thesisId ${r.thesisId} on ${input.plan.generatedAt.toISOString()}; skipping`); continue; }
      const price = (input.candleCache.get(asset) && closeAt(input.candleCache.get(asset)!, dayMs)) ?? null;
      if (price === null) continue;
      equity = closePosition(asset, pos, price, dayMs, r.decision === "flip" ? "thesis_flipped" : "thesis_closed", equity, closes);
      input.positions.delete(asset);
      if (r.decision === "flip" && r.flipTo && (r.flipTo === "long" || r.flipTo === "short")) {
        const newPos = openPosition(asset, r.flipTo, price, dayMs, equity, notionalPct, leverage, 0.5, r.reason, null);
        input.positions.set(asset, newPos);
        opens.push({ asset, pos: newPos });
      }
    }
  }

  for (const b of json.biasByAsset ?? []) {
    const asset = b.asset.toUpperCase();
    if (reviews !== undefined && reviewedAssets.has(asset)) continue;
    const candles = input.candleCache.get(asset);
    const price = candles ? closeAt(candles, dayMs) : null;
    if (price === null) continue;
    const current = input.positions.get(asset);
    const wantsLong = b.bias === "long";
    const wantsShort = b.bias === "short";

    if (reviews === undefined && current) {
      const reverse = (current.side === "long" && wantsShort) || (current.side === "short" && wantsLong);
      const neutralized = !wantsLong && !wantsShort;
      if (reverse || neutralized) {
        equity = closePosition(asset, current, price, dayMs, neutralized ? "agent_neutral" : "agent_reversed", equity, closes);
        input.positions.delete(asset);
      }
    }

    if ((wantsLong || wantsShort) && !input.positions.has(asset)) {
      const newPos = openPosition(asset, wantsLong ? "long" : "short", price, dayMs, equity, notionalPct, leverage, b.confidence, b.reason ?? "", b.invalidatesIf ?? null);
      input.positions.set(asset, newPos);
      opens.push({ asset, pos: newPos });
    }
  }

  return { closes, opens, newEquity: equity };
}
