import type { Candle } from "../../types";
import type { LocalVolumeProfile, VolumeBin } from "./types";

export function buildLocalVolumeProfile(input: {
  candles: Candle[];
  anchorPrice: number;
  radiusPct: number;
  binCount: number;
}): LocalVolumeProfile | null {
  const low = input.anchorPrice * (1 - input.radiusPct);
  const high = input.anchorPrice * (1 + input.radiusPct);
  if (high <= low || input.binCount <= 0) return null;

  const binSize = (high - low) / input.binCount;
  const bins: VolumeBin[] = [];
  for (let i = 0; i < input.binCount; i++) {
    const binLow = low + i * binSize;
    bins.push({ low: binLow, high: binLow + binSize, mid: binLow + binSize / 2, volume: 0 });
  }

  for (const candle of input.candles) {
    addCandleVolume(bins, candle);
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

function addCandleVolume(bins: VolumeBin[], candle: Candle): void {
  const touched: number[] = [];
  for (let i = 0; i < bins.length; i++) {
    if (candle.h >= bins[i].low && candle.l <= bins[i].high) touched.push(i);
  }
  if (touched.length === 0) return;
  const volumePerBin = candle.v / touched.length;
  for (const index of touched) {
    bins[index].volume += volumePerBin;
  }
}

function findPocIndex(bins: VolumeBin[]): number {
  let bestIndex = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].volume > bins[bestIndex].volume) bestIndex = i;
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
