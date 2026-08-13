import type { Candle } from "@strategy-lab/types";
import { buildLocalVolumeProfile } from "../read/build-local-volume-profile";
import { classifyCandles } from "./classify-candles";
import type { RegimeSegment } from "./types";

export function readRegimeSegments(input: {
  candles: Candle[];
  windowSize?: number;
  lookback?: number;
}): RegimeSegment[] {
  const windowSize = input.windowSize ?? 20;
  const target = input.candles.slice(-(input.lookback ?? 200));
  if (target.length < windowSize) return [];

  const chunks: { start: number; end: number; mode: RegimeSegment["mode"] }[] = [];

  for (let i = 0; i + windowSize <= target.length; i += windowSize) {
    const window = target.slice(i, i + windowSize);
    const regime = classifyCandles(window);
    if (regime.mode === "unknown") continue;
    chunks.push({ start: i, end: i + windowSize - 1, mode: regime.mode });
  }

  const segments: RegimeSegment[] = [];
  for (const chunk of chunks) {
    const last = segments[segments.length - 1];
    if (last && last.mode === chunk.mode) {
      last.endIndex = chunk.end;
      last.endTime = target[chunk.end].t;
    } else {
      segments.push({
        startIndex: chunk.start,
        endIndex: chunk.end,
        startTime: target[chunk.start].t,
        endTime: target[chunk.end].t,
        mode: chunk.mode,
        poc: 0,
        valueAreaLow: 0,
        valueAreaHigh: 0,
        bins: [],
      });
    }
  }

  for (const seg of segments) {
    const segCandles = target.slice(seg.startIndex, seg.endIndex + 1);
    if (segCandles.length === 0) continue;
    const lastPrice = segCandles[segCandles.length - 1].c;

    let segLow = Infinity;
    let segHigh = -Infinity;
    for (const c of segCandles) {
      if (c.l < segLow) segLow = c.l;
      if (c.h > segHigh) segHigh = c.h;
    }
    const padding = (segHigh - segLow) * 0.05 || 1;

    const profile = buildLocalVolumeProfile({
      candles: segCandles,
      anchorPrice: lastPrice,
      radiusPct: 0.015,
      binCount: 24,
      low: segLow - padding,
      high: segHigh + padding,
    });
    if (profile) {
      seg.poc = profile.poc;
      seg.valueAreaLow = profile.valueAreaLow;
      seg.valueAreaHigh = profile.valueAreaHigh;
      seg.bins = profile.bins;
    }
  }

  return segments;
}
