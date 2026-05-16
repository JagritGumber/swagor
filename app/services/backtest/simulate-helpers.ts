import type { Candle } from "@/lib/data-sources/hyperliquid";

export type SimulateOpts = {
  entryConfidence?: number;
  holdDays?: number;
  sizeUsd?: number;
};

const DEFAULT_ENTRY_CONF = 0.6;
const DEFAULT_HOLD_DAYS = 3;
const DEFAULT_SIZE_USD = 150;

export function normalizeSimulateOpts(opts?: SimulateOpts): Required<SimulateOpts> {
  return {
    entryConfidence: Math.max(0, Math.min(1, opts?.entryConfidence ?? DEFAULT_ENTRY_CONF)),
    holdDays: Math.max(1, Math.min(30, Math.floor(opts?.holdDays ?? DEFAULT_HOLD_DAYS))),
    sizeUsd: Math.max(1, Math.min(100_000, opts?.sizeUsd ?? DEFAULT_SIZE_USD)),
  };
}

export function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function closeAt(candles: Candle[], dayMs: number): number | null {
  const c = candles.find((cd) => cd.t === dayMs);
  if (!c) return null;
  const n = Number(c.c);
  return Number.isFinite(n) ? n : null;
}
