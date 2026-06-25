import type { OrderflowTrade } from "../orderflow/types";
import type { LocalVolumeProfile, VolumeBin } from "./types";

export function buildTradeVolumeProfile(input: {
  trades: OrderflowTrade[];
  anchorPrice: number;
  radiusPct: number;
  binCount: number;
}): LocalVolumeProfile | null {
  return buildTradeVolumeProfileFromRange({
    trades: input.trades,
    startIndex: 0,
    endIndex: input.trades.length,
    sampleLimit: null,
    anchorPrice: input.anchorPrice,
    radiusPct: input.radiusPct,
    binCount: input.binCount,
  });
}

export function buildTradeVolumeProfileFromRange(input: {
  trades: OrderflowTrade[];
  startIndex: number;
  endIndex: number;
  sampleLimit: number | null;
  anchorPrice: number;
  radiusPct: number;
  binCount: number;
}): LocalVolumeProfile | null {
  const low = input.anchorPrice * (1 - input.radiusPct);
  const high = input.anchorPrice * (1 + input.radiusPct);
  if (high <= low || input.binCount <= 0) return null;

  const binSize = (high - low) / input.binCount;
  const bins: VolumeBin[] = [];
  for (let index = 0; index < input.binCount; index += 1) {
    const binLow = low + index * binSize;
    bins.push({ low: binLow, high: binLow + binSize, mid: binLow + binSize / 2, volume: 0 });
  }

  const startIndex = Math.max(0, Math.min(input.trades.length, input.startIndex));
  const endIndex = Math.max(startIndex, Math.min(input.trades.length, input.endIndex));
  const count = endIndex - startIndex;
  const sampleLimit = input.sampleLimit;
  const stride = sampleLimit !== null && Number.isFinite(sampleLimit) && sampleLimit > 0 && count > sampleLimit
    ? count / sampleLimit
    : 1;
  const sampleCount = stride === 1 ? count : Math.floor(sampleLimit ?? count);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const trade = input.trades[startIndex + Math.floor(sampleIndex * stride)];
    if (trade.price < low || trade.price > high) continue;
    const index = Math.min(input.binCount - 1, Math.max(0, Math.floor((trade.price - low) / binSize)));
    bins[index].volume += trade.size;
  }

  const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
  if (totalVolume <= 0) return null;

  const pocIndex = findPocIndex(bins);
  const valueArea = findValueArea(bins, pocIndex, totalVolume * 0.7);
  return {
    low,
    high,
    binSize,
    poc: bins[pocIndex].mid,
    valueAreaLow: bins[valueArea.low].low,
    valueAreaHigh: bins[valueArea.high].high,
    bins,
  };
}

function findPocIndex(bins: VolumeBin[]): number {
  let bestIndex = 0;
  for (let index = 1; index < bins.length; index += 1) {
    if (bins[index].volume > bins[bestIndex].volume) bestIndex = index;
  }
  return bestIndex;
}

function findValueArea(bins: VolumeBin[], pocIndex: number, targetVolume: number): { low: number; high: number } {
  let low = pocIndex;
  let high = pocIndex;
  let volume = bins[pocIndex].volume;
  while (volume < targetVolume && (low > 0 || high < bins.length - 1)) {
    const nextLow = low > 0 ? bins[low - 1].volume : -1;
    const nextHigh = high < bins.length - 1 ? bins[high + 1].volume : -1;
    if (nextHigh >= nextLow) {
      high += 1;
      volume += bins[high].volume;
    } else {
      low -= 1;
      volume += bins[low].volume;
    }
  }
  return { low, high };
}

