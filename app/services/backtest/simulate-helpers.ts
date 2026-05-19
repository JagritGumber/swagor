import { db } from "@/lib/db/client";
import { backtestTrades } from "@/lib/db/schema";
import type { Candle } from "@/lib/data-sources/hyperliquid";

export const STARTING_EQUITY_USD = 1000;

/** thesisId = `${asset}:${entryDateISO}:${side}` — stable across replays. entryReason + invalidatesIf carry the swarm's WHY for the position so future plans can recall it. */
export type OpenPos = {
  side: "long" | "short";
  entryDate: Date; entryPrice: number; sizeUsd: number; leverage: number; confidence: number;
  stopPrice: number; tpPrice: number;
  thesisId: string; entryReason: string; invalidatesIf: string | null;
};

export function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function closeAt(candles: Candle[], dayMs: number): number | null {
  const n = Number(candles.find((cd) => cd.t === dayMs)?.c);
  return Number.isFinite(n) ? n : null;
}

export function candleAt(candles: Candle[], dayMs: number): Candle | null {
  return candles.find((cd) => cd.t === dayMs) ?? null;
}

const STOP_PCT = 0.04;
const TP_PCT = 0.08;

export function stopTpForSide(side: "long" | "short", entry: number): { stop: number; tp: number } {
  if (side === "long") return { stop: entry * (1 - STOP_PCT), tp: entry * (1 + TP_PCT) };
  return { stop: entry * (1 + STOP_PCT), tp: entry * (1 - TP_PCT) };
}

export async function closeAllAtEnd(input: {
  runId: string;
  positions: Map<string, OpenPos>;
  candleCache: Map<string, Candle[]>;
  lastDayMs: number;
}): Promise<{ equityDelta: number; closed: number }> {
  let equityDelta = 0;
  let closed = 0;
  for (const [asset, pos] of input.positions) {
    const candles = input.candleCache.get(asset);
    const price = candles ? closeAt(candles, input.lastDayMs) : null;
    if (price === null) continue;
    equityDelta += await writeBacktestClose({
      runId: input.runId, asset, pos,
      exitDate: new Date(input.lastDayMs), exitPrice: price, reason: "end_of_backtest",
    });
    closed++;
  }
  return { equityDelta, closed };
}

export function checkStopTpHit(pos: OpenPos, candle: Candle): { price: number; reason: string } | null {
  const high = Number(candle.h);
  const low = Number(candle.l);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  if (pos.side === "long") {
    if (low <= pos.stopPrice) return { price: pos.stopPrice, reason: "stop_loss" };
    if (high >= pos.tpPrice) return { price: pos.tpPrice, reason: "take_profit" };
  } else {
    if (high >= pos.stopPrice) return { price: pos.stopPrice, reason: "stop_loss" };
    if (low <= pos.tpPrice) return { price: pos.tpPrice, reason: "take_profit" };
  }
  return null;
}

export function computePnl(
  side: "long" | "short", entry: number, exit: number,
  sizeUsd: number, leverage: number,
): { pnlUsd: number; pnlPct: number } {
  const move = side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return { pnlUsd: sizeUsd * leverage * move, pnlPct: leverage * move * 100 };
}

/** Persist a closed simulated trade; returns realized PnL for the caller's compounding counter. */
export async function writeBacktestClose(input: {
  runId: string; asset: string; pos: OpenPos;
  exitDate: Date; exitPrice: number; reason: string;
}): Promise<number> {
  const { pnlUsd, pnlPct } = computePnl(input.pos.side, input.pos.entryPrice, input.exitPrice, input.pos.sizeUsd, input.pos.leverage);
  await db.insert(backtestTrades).values({
    backtestRunId: input.runId, asset: input.asset, side: input.pos.side,
    entryDate: input.pos.entryDate, entryPrice: input.pos.entryPrice.toString(),
    exitDate: input.exitDate, exitPrice: input.exitPrice.toString(),
    sizeUsd: input.pos.sizeUsd.toString(),
    pnlUsd: pnlUsd.toString(), pnlPct: pnlPct.toString(),
    biasConfidence: input.pos.confidence.toString(),
    status: "closed", exitReason: input.reason,
  });
  return pnlUsd;
}
