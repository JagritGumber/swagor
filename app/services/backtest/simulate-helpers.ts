import { db } from "@/lib/db/client";
import { backtestTrades } from "@/lib/db/schema";
import type { Candle } from "@/lib/data-sources/hyperliquid";

export const STARTING_EQUITY_USD = 1000;

export type OpenPos = {
  side: "long" | "short";
  entryDate: Date;
  entryPrice: number;
  sizeUsd: number;
  leverage: number;
  confidence: number;
};

export function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function closeAt(candles: Candle[], dayMs: number): number | null {
  const c = candles.find((cd) => cd.t === dayMs);
  if (!c) return null;
  const n = Number(c.c);
  return Number.isFinite(n) ? n : null;
}

export function computePnl(
  side: "long" | "short", entry: number, exit: number,
  sizeUsd: number, leverage: number,
): { pnlUsd: number; pnlPct: number } {
  const move = side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return { pnlUsd: sizeUsd * leverage * move, pnlPct: leverage * move * 100 };
}

/**
 * Persist a closed simulated trade and return the realized PnL so the
 * caller can update its compounding equity counter. Keeps the
 * simulator loop body focused on agent-decision routing instead of
 * row-shape boilerplate.
 */
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
