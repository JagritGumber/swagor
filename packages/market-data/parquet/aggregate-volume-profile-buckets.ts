import type { BybitTradeRow } from "../bybit/parse-bybit-trade-csv";
import type { VolumeProfileBucket } from "./types";

export function aggregateVolumeProfileBuckets(input: {
  trades: BybitTradeRow[];
  windowMs?: number;
  priceBinSize: number;
}): VolumeProfileBucket[] {
  const windowMs = input.windowMs ?? 300_000;
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("windowMs must be positive");
  if (!Number.isFinite(input.priceBinSize) || input.priceBinSize <= 0) throw new Error("priceBinSize must be positive");

  const profiles = new Map<string, VolumeProfileBucket>();
  for (const trade of input.trades) {
    const startMs = Math.floor(trade.time / windowMs) * windowMs;
    const binLow = Math.floor(trade.price / input.priceBinSize) * input.priceBinSize;
    const key = `${startMs}:${binLow}`;
    const existing = profiles.get(key);
    if (existing) {
      existing.volume += trade.size;
      continue;
    }
    profiles.set(key, {
      startMs,
      endMs: startMs + windowMs,
      binLow,
      binHigh: binLow + input.priceBinSize,
      binMid: binLow + input.priceBinSize / 2,
      volume: trade.size,
    });
  }

  return [...profiles.values()].sort((left, right) => left.startMs - right.startMs || left.binLow - right.binLow);
}

