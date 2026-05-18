import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { DailyPlan } from "@/lib/db/schema";
import { candleAt, checkStopTpHit, closeAt, computePnl, type OpenPos, stopTpForSide, utcDayMs } from "./simulate-helpers";

type BiasEntry = { asset: string; bias: string; confidence: number; reason?: string; invalidatesIf?: string | null; flipsTo?: string | null };
type PlanJson = { biasByAsset?: BiasEntry[]; riskCaps?: { maxLeverage?: number; maxNotionalPctOfEquity?: number } };
export type BacktestCloseEvent = { asset: string; pos: OpenPos; exitDate: Date; exitPrice: number; reason: string };
export type BacktestOpenEvent = { asset: string; pos: OpenPos };
export type BacktestDayResult = { closes: BacktestCloseEvent[]; opens: BacktestOpenEvent[]; newEquity: number };

/**
 * Pure per-day step shared by the actual simulator (which persists
 * closes to backtest_trades) and the replay helper used to build
 * backtest thesis memory (which only mutates an in-memory positions
 * Map). Stops/TPs first, then bias-driven closes, then opens. Caller
 * decides what to do with the returned closes/opens events.
 */
export function simulateOneBacktestDay(input: {
  plan: DailyPlan;
  positions: Map<string, OpenPos>;
  candleCache: Map<string, Candle[]>;
  equity: number;
}): BacktestDayResult {
  const dayMs = utcDayMs(input.plan.generatedAt);
  let equity = input.equity;
  const closes: BacktestCloseEvent[] = [];
  const opens: BacktestOpenEvent[] = [];

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
  if (!json?.biasByAsset) return { closes, opens, newEquity: equity };

  const notionalPct = json.riskCaps?.maxNotionalPctOfEquity ?? 15;
  const leverage = Math.max(1, json.riskCaps?.maxLeverage ?? 1);

  for (const b of json.biasByAsset) {
    const asset = b.asset.toUpperCase();
    const candles = input.candleCache.get(asset);
    const price = candles ? closeAt(candles, dayMs) : null;
    if (price === null) continue;
    const current = input.positions.get(asset);
    const wantsLong = b.bias === "long";
    const wantsShort = b.bias === "short";
    const reverse = current && ((current.side === "long" && wantsShort) || (current.side === "short" && wantsLong));
    const neutralized = current && !wantsLong && !wantsShort;

    if (current && (reverse || neutralized)) {
      const { pnlUsd } = computePnl(current.side, current.entryPrice, price, current.sizeUsd, current.leverage);
      closes.push({ asset, pos: current, exitDate: new Date(dayMs), exitPrice: price, reason: neutralized ? "agent_neutral" : "agent_reversed" });
      equity += pnlUsd;
      input.positions.delete(asset);
    }

    if ((wantsLong || wantsShort) && !input.positions.has(asset)) {
      const side = wantsLong ? "long" : "short";
      const { stop, tp } = stopTpForSide(side, price);
      const entryDate = new Date(dayMs);
      const newPos: OpenPos = {
        side, entryDate, entryPrice: price,
        sizeUsd: equity * notionalPct / 100,
        leverage, confidence: b.confidence,
        stopPrice: stop, tpPrice: tp,
        thesisId: `${asset}:${entryDate.toISOString()}:${side}`,
        entryReason: b.reason ?? "",
        invalidatesIf: b.invalidatesIf ?? null,
      };
      input.positions.set(asset, newPos);
      opens.push({ asset, pos: newPos });
    }
  }

  return { closes, opens, newEquity: equity };
}
