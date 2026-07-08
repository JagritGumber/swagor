import type { Candle } from "../../shared/types";
import type { VolumeProfile, VolumeBin } from "../../shared/market/metrics";

export function createVolumeProfileState(input: {
  candles: Candle[];
  anchorPrice: number;
  radiusPct: number;
  binCount: number;
}): VolumeProfile | null {
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

  return rebuildProfile(low, high, binSize, bins);
}

export function addCandleToProfile(profile: VolumeProfile, candle: Candle): VolumeProfile {
  const bins = profile.bins.map((b) => ({ ...b }));
  addCandleVolume(bins, candle);
  return rebuildProfile(profile.low, profile.high, profile.binSize, bins);
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

function rebuildProfile(low: number, high: number, binSize: number, bins: VolumeBin[]): VolumeProfile {
  const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
  if (totalVolume <= 0) {
    return { low, high, binSize, poc: 0, valueAreaLow: 0, valueAreaHigh: 0, bins };
  }

  let pocIndex = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].volume > bins[pocIndex].volume) pocIndex = i;
  }

  const targetVolume = totalVolume * 0.7;
  let vaLow = pocIndex;
  let vaHigh = pocIndex;
  let vaVolume = bins[pocIndex].volume;
  while (vaVolume < targetVolume && (vaLow > 0 || vaHigh < bins.length - 1)) {
    const nextLow = vaLow > 0 ? bins[vaLow - 1].volume : -1;
    const nextHigh = vaHigh < bins.length - 1 ? bins[vaHigh + 1].volume : -1;
    if (nextHigh >= nextLow) {
      vaHigh += 1;
      vaVolume += bins[vaHigh].volume;
    } else {
      vaLow -= 1;
      vaVolume += bins[vaLow].volume;
    }
  }

  return {
    low,
    high,
    binSize,
    poc: bins[pocIndex].mid,
    valueAreaLow: bins[vaLow].low,
    valueAreaHigh: bins[vaHigh].high,
    bins,
  };
}
