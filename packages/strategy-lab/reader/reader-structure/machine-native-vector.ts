import type { OrderflowBucket } from "@market-data/parquet/types";
import type { VolumeProfileStructure, VolumeNode } from "@strategy-lab/read-core/read/parse-volume-profile-structure";

export type SpatialFeatures = {
  distToNearestHVN_atr: number;
  distToNearestLVN_atr: number;
  distToPOC_atr: number;
  distToValueHigh_atr: number;
  distToValueLow_atr: number;
  volumeGradient: number;
  volumeROC: number;
};

export type FlowFeatures = {
  cvdVelocity_z: number;
  cvdAcceleration_z: number;
  deltaPerTick_z: number;
};

export type InteractionFeatures = {
  priceCvdCorrelation: number;
  imbalanceDecayRate: number;
};

export type MachineNativeVector = {
  spatial: SpatialFeatures;
  flow: FlowFeatures;
  interaction: InteractionFeatures;
};

function zScore(value: number, mean: number, std: number): number {
  return std > 0 ? (value - mean) / std : 0;
}

function rollingMean(arr: number[], window: number): number {
  if (arr.length === 0) return 0;
  const slice = arr.slice(-window);
  return slice.reduce((s, x) => s + x, 0) / slice.length;
}

function rollingStd(arr: number[], window: number): number {
  if (arr.length < 2) return 0;
  const slice = arr.slice(-window);
  const m = rollingMean(arr, window);
  return Math.sqrt(slice.reduce((s, x) => s + (x - m) ** 2, 0) / slice.length);
}

function computeATR(buckets: OrderflowBucket[], window: number): number {
  if (buckets.length < 2) return 0;
  const slice = buckets.slice(-window);
  const ranges = slice.map((b) => b.high - b.low);
  return ranges.reduce((s, x) => s + x, 0) / ranges.length;
}

function findVolumeAtPrice(price: number, structure: VolumeProfileStructure | null): number {
  if (!structure) return 0;
  const bin = structure.bins.find((b) => price >= b.low && price <= b.high);
  return bin?.volume ?? 0;
}

function findNearestNodeDistance(price: number, nodes: VolumeNode[]): number {
  if (nodes.length === 0) return Infinity;
  return Math.min(...nodes.map((n) => Math.abs(price - n.mid)));
}

function linearRegressionSlope(arr: number[]): number {
  if (arr.length < 2) return 0;
  const n = arr.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = arr.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (arr[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den > 0 ? num / den : 0;
}

function rollingCorrelation(xs: number[], ys: number[], window: number): number {
  const n = Math.min(xs.length, ys.length, window);
  if (n < 3) return 0;
  const xSlice = xs.slice(-n);
  const ySlice = ys.slice(-n);
  const xMean = xSlice.reduce((s, x) => s + x, 0) / n;
  const yMean = ySlice.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean;
    const dy = ySlice[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

export function extractMachineNativeVector(
  price: number,
  structure: VolumeProfileStructure | null,
  orderflowBuckets: OrderflowBucket[],
): MachineNativeVector {
  const ATR_WINDOW = 20;
  const CVD_HISTORY_WINDOW = 30;
  const CORRELATION_WINDOW = 20;

  const atr = computeATR(orderflowBuckets, ATR_WINDOW);

  const spatial = extractSpatial(price, structure, orderflowBuckets, atr);
  const flow = extractFlow(orderflowBuckets, CVD_HISTORY_WINDOW);
  const interaction = extractInteraction(price, orderflowBuckets, CORRELATION_WINDOW);

  return { spatial, flow, interaction };
}

function extractSpatial(
  price: number,
  structure: VolumeProfileStructure | null,
  orderflowBuckets: OrderflowBucket[],
  atr: number,
): SpatialFeatures {
  if (!structure || atr === 0) {
    return {
      distToNearestHVN_atr: 0,
      distToNearestLVN_atr: 0,
      distToPOC_atr: 0,
      distToValueHigh_atr: 0,
      distToValueLow_atr: 0,
      volumeGradient: 0,
      volumeROC: 0,
    };
  }

  const distToNearestHVN = findNearestNodeDistance(price, structure.hvn);
  const distToNearestLVN = findNearestNodeDistance(price, structure.lvn);
  const distToPOC = Math.abs(price - structure.poc);
  const distToValueHigh = Math.abs(price - structure.valueAreaHigh);
  const distToValueLow = Math.abs(price - structure.valueAreaLow);

  const currentVolume = findVolumeAtPrice(price, structure);
  const nearestHvnVolume = structure.hvn.length > 0
    ? Math.max(...structure.hvn.map((n) => n.volume))
    : 1;
  const volumeGradient = nearestHvnVolume > 0 ? currentVolume / nearestHvnVolume : 0;

  const recentVolumes = orderflowBuckets.slice(-10).map((b) => b.buyVolume + b.sellVolume);
  const volumeROC = recentVolumes.length >= 2
    ? (recentVolumes[recentVolumes.length - 1] - recentVolumes[0]) / (recentVolumes[0] || 1)
    : 0;

  return {
    distToNearestHVN_atr: distToNearestHVN / atr,
    distToNearestLVN_atr: distToNearestLVN / atr,
    distToPOC_atr: distToPOC / atr,
    distToValueHigh_atr: distToValueHigh / atr,
    distToValueLow_atr: distToValueLow / atr,
    volumeGradient,
    volumeROC,
  };
}

function extractFlow(
  orderflowBuckets: OrderflowBucket[],
  historyWindow: number,
): FlowFeatures {
  if (orderflowBuckets.length < 3) {
    return { cvdVelocity_z: 0, cvdAcceleration_z: 0, deltaPerTick_z: 0 };
  }

  const deltas = orderflowBuckets.map((b) => b.delta);
  const cvdSeries: number[] = [];
  let cumDelta = 0;
  for (const d of deltas) {
    cumDelta += d;
    cvdSeries.push(cumDelta);
  }

  const velocities: number[] = [];
  for (let i = 1; i < cvdSeries.length; i++) {
    velocities.push(cvdSeries[i] - cvdSeries[i - 1]);
  }

  const accelerations: number[] = [];
  for (let i = 1; i < velocities.length; i++) {
    accelerations.push(velocities[i] - velocities[i - 1]);
  }

  const deltaPerTicks = orderflowBuckets.map((b) =>
    b.tradeCount > 0 ? b.delta / b.tradeCount : 0,
  );

  const currentVelocity = velocities.length > 0 ? velocities[velocities.length - 1] : 0;
  const currentAcceleration = accelerations.length > 0 ? accelerations[accelerations.length - 1] : 0;
  const currentDeltaPerTick = deltaPerTicks.length > 0 ? deltaPerTicks[deltaPerTicks.length - 1] : 0;

  const velocityMean = rollingMean(velocities, historyWindow);
  const velocityStd = rollingStd(velocities, historyWindow);
  const accelerationMean = rollingMean(accelerations, historyWindow);
  const accelerationStd = rollingStd(accelerations, historyWindow);
  const deltaPerTickMean = rollingMean(deltaPerTicks, historyWindow);
  const deltaPerTickStd = rollingStd(deltaPerTicks, historyWindow);

  return {
    cvdVelocity_z: zScore(currentVelocity, velocityMean, velocityStd),
    cvdAcceleration_z: zScore(currentAcceleration, accelerationMean, accelerationStd),
    deltaPerTick_z: zScore(currentDeltaPerTick, deltaPerTickMean, deltaPerTickStd),
  };
}

function extractInteraction(
  price: number,
  orderflowBuckets: OrderflowBucket[],
  correlationWindow: number,
): InteractionFeatures {
  if (orderflowBuckets.length < 5) {
    return { priceCvdCorrelation: 0, imbalanceDecayRate: 0 };
  }

  const priceChanges: number[] = [];
  const cvdChanges: number[] = [];
  let cumDelta = 0;
  let prevPrice = orderflowBuckets[0].close;

  for (const b of orderflowBuckets) {
    cumDelta += b.delta;
    priceChanges.push(b.close - prevPrice);
    cvdChanges.push(b.delta);
    prevPrice = b.close;
  }

  const priceCvdCorrelation = rollingCorrelation(priceChanges, cvdChanges, correlationWindow);

  const recentBuckets = orderflowBuckets.slice(-10);
  let imbalanceSum = 0;
  let imbalanceCount = 0;
  for (let i = 1; i < recentBuckets.length; i++) {
    const prevImbalance = recentBuckets[i - 1].buyVolume - recentBuckets[i - 1].sellVolume;
    const currImbalance = recentBuckets[i].buyVolume - recentBuckets[i].sellVolume;
    if (Math.abs(prevImbalance) > 0) {
      const decay = (prevImbalance - currImbalance) / Math.abs(prevImbalance);
      imbalanceSum += decay;
      imbalanceCount++;
    }
  }

  const imbalanceDecayRate = imbalanceCount > 0 ? imbalanceSum / imbalanceCount : 0;

  return { priceCvdCorrelation, imbalanceDecayRate };
}
