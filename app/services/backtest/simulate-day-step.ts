import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { DailyPlan } from "@/lib/db/schema";
import { candleAt, checkStopTpHit, closeAt, computePnl, type OpenPos, utcDayMs } from "./simulate-helpers";
import { deterministicRiskPct, openPosition, openTopCandidate, tryReduce, type BacktestCloseEvent, type OpenCandidate } from "./simulate-day-helpers";
import { DEFAULT_POLICY, notionalForConfidence } from "./strategy-policy";

type BiasEntry = { asset: string; bias: string; confidence: number; reason?: string; invalidatesIf?: string | null; flipsTo?: string | null; realizedVolPct1h?: number; stopLossPct?: number; takeProfitPct?: number };
type ThesisReviewJson = { thesisId: string; asset: string; decision: "maintain" | "reduce" | "close" | "flip"; flipTo: "long" | "short" | "avoid" | "neutral" | null; reason: string };
type PlanJson = { biasByAsset?: BiasEntry[]; riskCaps?: { maxLeverage?: number; maxNotionalPctOfEquity?: number }; activeThesisReviews?: ThesisReviewJson[] };
export type { BacktestCloseEvent };
export type BacktestOpenEvent = { asset: string; pos: OpenPos };
export type BacktestDayResult = { closes: BacktestCloseEvent[]; opens: BacktestOpenEvent[]; newEquity: number };

/** Pure per-day step shared by the simulator and the thesis-memory replay. Order: stops/TPs, thesis reviews (close/flip/reduce), then opens for assets without an active position. Sizing is deterministic from DEFAULT_POLICY; the model's `riskCaps` are ignored. */
export function simulateOneBacktestDay(input: { plan: DailyPlan; positions: Map<string, OpenPos>; candleCache: Map<string, Candle[]>; equity: number }): BacktestDayResult {
  const dayMs = utcDayMs(input.plan.generatedAt);
  let equity = input.equity;
  const closes: BacktestCloseEvent[] = [];
  const opens: BacktestOpenEvent[] = [];
  console.info("[backtest-sim] policy: DEFAULT");

  for (const [asset, pos] of [...input.positions]) {
    const candle = (input.candleCache.get(asset) && candleAt(input.candleCache.get(asset)!, dayMs)) || null;
    if (!candle) continue;
    const hit = checkStopTpHit(pos, candle);
    if (!hit) continue;
    const { pnlUsd } = computePnl(pos.side, pos.entryPrice, hit.price, pos.sizeUsd, pos.leverage);
    closes.push({ asset, pos, exitDate: new Date(dayMs), exitPrice: hit.price, reason: hit.reason });
    equity += pnlUsd;
    input.positions.delete(asset);
  }

  if (input.plan.status !== "complete") return { closes, opens, newEquity: equity };
  const json = input.plan.planJson as PlanJson | null;
  if (!json) return { closes, opens, newEquity: equity };
  const reviews = json.activeThesisReviews;
  const reviewedAssets = new Set((reviews ?? []).map((r) => r.asset.toUpperCase()));

  if (reviews !== undefined) {
    for (const r of reviews) {
      if (r.decision === "maintain") continue;
      const asset = r.asset.toUpperCase();
      const pos = input.positions.get(asset);
      if (!pos || pos.thesisId !== r.thesisId) { console.warn(`[backtest-sim] hallucinated thesisId ${r.thesisId} on ${input.plan.generatedAt.toISOString()}; skipping`); continue; }
      const price = (input.candleCache.get(asset) && closeAt(input.candleCache.get(asset)!, dayMs)) ?? null;
      if (price === null) continue;
      if (r.decision === "reduce") { equity = tryReduce(asset, pos, price, dayMs, equity, closes, input.plan.generatedAt); continue; }
      const { pnlUsd } = computePnl(pos.side, pos.entryPrice, price, pos.sizeUsd, pos.leverage);
      closes.push({ asset, pos, exitDate: new Date(dayMs), exitPrice: price, reason: r.decision === "flip" ? "thesis_flipped" : "thesis_closed" });
      equity += pnlUsd;
      input.positions.delete(asset);
      if (r.decision === "flip" && r.flipTo && (r.flipTo === "long" || r.flipTo === "short")) {
        const det = deterministicRiskPct(undefined);
        const flipNotional = notionalForConfidence(DEFAULT_POLICY, 0.5);
        const newPos = openPosition(asset, r.flipTo, price, dayMs, equity, flipNotional, DEFAULT_POLICY.maxLeverage, 0.5, r.reason, null, det.stopPct, det.tpPct);
        input.positions.set(asset, newPos);
        opens.push({ asset, pos: newPos });
      }
    }
  }

  const candidates: OpenCandidate[] = [];
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
        const { pnlUsd } = computePnl(current.side, current.entryPrice, price, current.sizeUsd, current.leverage);
        closes.push({ asset, pos: current, exitDate: new Date(dayMs), exitPrice: price, reason: neutralized ? "agent_neutral" : "agent_reversed" });
        equity += pnlUsd;
        input.positions.delete(asset);
      }
    }

    if ((wantsLong || wantsShort) && !input.positions.has(asset)) {
      if (b.confidence < DEFAULT_POLICY.minConfidenceToOpen) {
        console.info(`[backtest-sim] skip ${asset}: conf ${b.confidence.toFixed(2)} < ${DEFAULT_POLICY.minConfidenceToOpen}`);
        continue;
      }
      candidates.push({ b, price, side: wantsLong ? "long" : "short" });
    }
  }
  openTopCandidate(candidates, DEFAULT_POLICY, dayMs, equity, input.positions, opens);

  return { closes, opens, newEquity: equity };
}
