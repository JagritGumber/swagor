import type { VolumeProfileBucket } from "@market-data/parquet/types";
import type { VolumeBin } from "./types";

export type VolumeNode = {
  low: number;
  high: number;
  mid: number;
  volume: number;
  kind: "hvn" | "lvn" | "poc";
};

export type VolumeProfileStructure = {
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  hvn: VolumeNode[];
  lvn: VolumeNode[];
  bins: VolumeBin[];
  totalVolume: number;
  profileLow: number;
  profileHigh: number;
};

export function parseVolumeProfileStructure(input: {
  buckets: VolumeProfileBucket[];
  hvnThresholdPct?: number;
  lvnThresholdPct?: number;
}): VolumeProfileStructure | null {
  if (input.buckets.length === 0) return null;

  const merged = mergeProfileBuckets(input.buckets);
  if (merged.length === 0) return null;

  const totalVolume = merged.reduce((sum, b) => sum + b.volume, 0);
  if (totalVolume <= 0) return null;

  const pocIndex = findMaxVolumeIndex(merged);
  const poc = merged[pocIndex].mid;

  const valueArea = findValueArea(merged, pocIndex, totalVolume * 0.7);
  const valueAreaHigh = merged[valueArea.high].high;
  const valueAreaLow = merged[valueArea.low].low;

  const avgVolume = totalVolume / merged.length;
  const hvnThreshold = avgVolume * (input.hvnThresholdPct ?? 1.5);
  const lvnThreshold = avgVolume * (input.lvnThresholdPct ?? 0.5);

  const nodes = classifyNodes(merged, pocIndex, hvnThreshold, lvnThreshold);

  return {
    poc,
    valueAreaHigh,
    valueAreaLow,
    hvn: nodes.filter((n) => n.kind === "hvn"),
    lvn: nodes.filter((n) => n.kind === "lvn"),
    bins: merged,
    totalVolume,
    profileLow: merged[0].low,
    profileHigh: merged[merged.length - 1].high,
  };
}

function mergeProfileBuckets(buckets: VolumeProfileBucket[]): VolumeBin[] {
  const binMap = new Map<string, VolumeBin>();
  for (const bucket of buckets) {
    const key = `${bucket.binLow.toFixed(8)}_${bucket.binHigh.toFixed(8)}`;
    const existing = binMap.get(key);
    if (existing) {
      existing.volume += bucket.volume;
    } else {
      binMap.set(key, {
        low: bucket.binLow,
        high: bucket.binHigh,
        mid: bucket.binMid,
        volume: bucket.volume,
      });
    }
  }
  return Array.from(binMap.values()).sort((a, b) => a.low - b.low);
}

function findMaxVolumeIndex(bins: VolumeBin[]): number {
  let best = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].volume > bins[best].volume) best = i;
  }
  return best;
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

function classifyNodes(
  bins: VolumeBin[],
  pocIndex: number,
  hvnThreshold: number,
  lvnThreshold: number,
): VolumeNode[] {
  const nodes: VolumeNode[] = [];
  let i = 0;
  while (i < bins.length) {
    if (bins[i].volume >= hvnThreshold) {
      let end = i;
      while (end + 1 < bins.length && bins[end + 1].volume >= hvnThreshold) end++;
      nodes.push({
        low: bins[i].low,
        high: bins[end].high,
        mid: (bins[i].low + bins[end].high) / 2,
        volume: bins.slice(i, end + 1).reduce((s, b) => s + b.volume, 0),
        kind: i <= pocIndex && end >= pocIndex ? "poc" : "hvn",
      });
      i = end + 1;
    } else if (bins[i].volume <= lvnThreshold) {
      let end = i;
      while (end + 1 < bins.length && bins[end + 1].volume <= lvnThreshold) end++;
      nodes.push({
        low: bins[i].low,
        high: bins[end].high,
        mid: (bins[i].low + bins[end].high) / 2,
        volume: bins.slice(i, end + 1).reduce((s, b) => s + b.volume, 0),
        kind: "lvn",
      });
      i = end + 1;
    } else {
      i++;
    }
  }
  return nodes;
}
