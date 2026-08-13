import type { OrderflowBucket } from "@market-data/parquet/types";
import type { VolumeProfileStructure, VolumeNode } from "@strategy-lab/read-core/read/parse-volume-profile-structure";

export type SpatialFeatures = {
  distToNearestHVN_norm: number;
  distToNearestLVN_norm: number;
  distToPOC_norm: number;
  distToValueHigh_norm: number;
  distToValueLow_norm: number;
  volumeGradient: number;
  volumeROC: number;
  profileSkewness: number;
  volumeConcentration: number;
};

export type FlowFeatures = {
  cvdVelocity_z: number;
  cvdAcceleration_z: number;
  deltaPerTick_z: number;
};

export type InteractionFeatures = {
  priceCvdCorrelation: number;
  deltaAtPriceRatio: number;
};

export type MachineNativeVector = {
  spatial: SpatialFeatures;
  flow: FlowFeatures;
  interaction: InteractionFeatures;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function zScore(value: number, mean: number, std: number): number {
  return std > 0 ? clamp((value - mean) / std, -10, 10) : 0;
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

function findVolumeAtPrice(price: number, structure: VolumeProfileStructure | null): number {
  if (!structure) return 0;
  const bin = structure.bins.find((b) => price >= b.low && price <= b.high);
  return bin?.volume ?? 0;
}

function findNearestNodeDistance(price: number, nodes: VolumeNode[]): number {
  if (nodes.length === 0) return Infinity;
  return Math.min(...nodes.map((n) => Math.abs(price - n.mid)));
}

function computeProfileSkewness(structure: VolumeProfileStructure | null): number {
  if (!structure || structure.bins.length < 3) return 0;
  const volumes = structure.bins.map((b) => b.volume);
  const total = volumes.reduce((s, x) => s + x, 0);
  if (total <= 0) return 0;
  const weights = volumes.map((v) => v / total);
  const mids = structure.bins.map((b) => b.mid);
  const mean = mids.reduce((s, x, i) => s + x * weights[i], 0);
  const variance = mids.reduce((s, x, i) => s + weights[i] * (x - mean) ** 2, 0);
  const std = Math.sqrt(variance);
  if (std <= 0) return 0;
  const skew = weights.reduce((s, w, i) => s + w * ((mids[i] - mean) / std) ** 3, 0);
  return clamp(skew, -3, 3);
}

function computeVolumeConcentration(structure: VolumeProfileStructure | null): number {
  if (!structure || structure.bins.length < 2 || structure.totalVolume <= 0) return 0;
  const maxVol = Math.max(...structure.bins.map((b) => b.volume));
  const ratio = maxVol / (structure.totalVolume / structure.bins.length);
  return clamp(Math.log(ratio + 1), -3, 3);
}

function buildEwmaStats(buckets: OrderflowBucket[]): {
  velocityMean: number;
  velocityM2: number;
  accelerationMean: number;
  accelerationM2: number;
  deltaPerTickMean: number;
  deltaPerTickM2: number;
  count: number;
} {
  if (buckets.length < 3) {
    return { velocityMean: 0, velocityM2: 0, accelerationMean: 0, accelerationM2: 0, deltaPerTickMean: 0, deltaPerTickM2: 0, count: 0 };
  }

  const deltas = buckets.map((b) => b.delta);
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

  const deltaPerTicks = buckets.map((b) =>
    b.tradeCount > 0 ? b.delta / b.tradeCount : 0,
  );

  let vMean = 0;
  let vM2 = 0;
  let aMean = 0;
  let aM2 = 0;
  let dMean = 0;
  let dM2 = 0;
  let count = 0;

  const len = Math.min(velocities.length, accelerations.length, deltaPerTicks.length);
  for (let i = 0; i < len; i++) {
    count++;
    const v = velocities[i];
    const delta = v - vMean;
    vMean += delta / count;
    vM2 += delta * (v - vMean);

    const a = accelerations[i];
    const aDelta = a - aMean;
    aMean += aDelta / count;
    aM2 += aDelta * (a - aMean);

    const d = deltaPerTicks[i];
    const dDelta = d - dMean;
    dMean += dDelta / count;
    dM2 += dDelta * (d - dMean);
  }

  return {
    velocityMean: vMean, velocityM2: vM2,
    accelerationMean: aMean, accelerationM2: aM2,
    deltaPerTickMean: dMean, deltaPerTickM2: dM2,
    count,
  };
}

function computeTimeWindowCorrelation(
  priceChanges: number[],
  cvdChanges: number[],
  bucketMs: number[],
  windowMs: number,
): number {
  if (priceChanges.length < 3 || bucketMs.length < 3) return 0;

  const lastMs = bucketMs[bucketMs.length - 1];
  const cutoffMs = lastMs - windowMs;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let n = 0;

  for (let i = 0; i < priceChanges.length; i++) {
    if (bucketMs[i] < cutoffMs) continue;
    const x = priceChanges[i];
    const y = cvdChanges[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
    n++;
  }

  if (n < 3) return 0;
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return den > 0 ? clamp(num / den, -1, 1) : 0;
}

function computeDeltaAtPriceRatio(
  price: number,
  buckets: OrderflowBucket[],
  binSize: number,
): number {
  const EPSILON = 0.01;
  const currentWindowMs = 60000;
  const previousWindowMs = 60000;

  if (buckets.length < 2) return 1;

  const lastMs = buckets[buckets.length - 1].bucketMs;
  const currentStart = lastMs - currentWindowMs;
  const previousStart = currentStart - previousWindowMs;

  let currentDelta = 0;
  let previousDelta = 0;

  for (const b of buckets) {
    const inCurrent = b.bucketMs >= currentStart;
    const inPrevious = b.bucketMs >= previousStart && b.bucketMs < currentStart;
    const atPrice = Math.abs(b.close - price) < binSize * 0.5;

    if (inCurrent && atPrice) currentDelta += b.delta;
    if (inPrevious && atPrice) previousDelta += b.delta;
  }

  const raw = currentDelta / (Math.abs(previousDelta) + EPSILON);
  return clamp(raw, -10, 10);
}

export function extractMachineNativeVector(
  price: number,
  structure: VolumeProfileStructure | null,
  orderflowBuckets: OrderflowBucket[],
): MachineNativeVector {
  const CORRELATION_WINDOW_MS = 900000;

  const profileRange = structure
    ? structure.profileHigh - structure.profileLow
    : 1;
  const binSize = structure?.bins[0]
    ? structure.bins[0].high - structure.bins[0].low
    : 1;

  const spatial = extractSpatial(price, structure, orderflowBuckets, profileRange);
  const flow = extractFlow(orderflowBuckets);
  const interaction = extractInteraction(price, orderflowBuckets, binSize, CORRELATION_WINDOW_MS);

  return { spatial, flow, interaction };
}

function extractSpatial(
  price: number,
  structure: VolumeProfileStructure | null,
  orderflowBuckets: OrderflowBucket[],
  profileRange: number,
): SpatialFeatures {
  if (!structure || profileRange === 0) {
    return {
      distToNearestHVN_norm: 0, distToNearestLVN_norm: 0, distToPOC_norm: 0,
      distToValueHigh_norm: 0, distToValueLow_norm: 0,
      volumeGradient: 0, volumeROC: 0, profileSkewness: 0, volumeConcentration: 0,
    };
  }

  const norm = (d: number) => clamp(d / profileRange, -3, 3);

  const distToNearestHVN = findNearestNodeDistance(price, structure.hvn);
  const distToNearestLVN = findNearestNodeDistance(price, structure.lvn);
  const distToPOC = Math.abs(price - structure.poc);
  const distToValueHigh = Math.abs(price - structure.valueAreaHigh);
  const distToValueLow = Math.abs(price - structure.valueAreaLow);

  const currentVolume = findVolumeAtPrice(price, structure);
  const nearestHvnVolume = structure.hvn.length > 0
    ? Math.max(...structure.hvn.map((n) => n.volume))
    : 1;
  const volumeGradient = clamp(nearestHvnVolume > 0 ? currentVolume / nearestHvnVolume : 0, -3, 3);

  const recentVolumes = orderflowBuckets.slice(-10).map((b) => b.buyVolume + b.sellVolume);
  const volumeROC = recentVolumes.length >= 2
    ? clamp(Math.log((recentVolumes[recentVolumes.length - 1] + 1) / (recentVolumes[0] + 1)), -3, 3)
    : 0;

  return {
    distToNearestHVN_norm: norm(distToNearestHVN),
    distToNearestLVN_norm: norm(distToNearestLVN),
    distToPOC_norm: norm(distToPOC),
    distToValueHigh_norm: norm(distToValueHigh),
    distToValueLow_norm: norm(distToValueLow),
    volumeGradient,
    volumeROC,
    profileSkewness: computeProfileSkewness(structure),
    volumeConcentration: computeVolumeConcentration(structure),
  };
}

function extractFlow(orderflowBuckets: OrderflowBucket[]): FlowFeatures {
  if (orderflowBuckets.length < 3) {
    return { cvdVelocity_z: 0, cvdAcceleration_z: 0, deltaPerTick_z: 0 };
  }

  const ewma = buildEwmaStats(orderflowBuckets);
  if (ewma.count < 3) {
    return { cvdVelocity_z: 0, cvdAcceleration_z: 0, deltaPerTick_z: 0 };
  }

  const deltas = orderflowBuckets.map((b) => b.delta);
  const cvdSeries: number[] = [];
  let cumDelta = 0;
  for (const d of deltas) {
    cumDelta += d;
    cvdSeries.push(cumDelta);
  }

  const currentVelocity = cvdSeries.length >= 2
    ? cvdSeries[cvdSeries.length - 1] - cvdSeries[cvdSeries.length - 2]
    : 0;

  const velocities: number[] = [];
  for (let i = 1; i < cvdSeries.length; i++) {
    velocities.push(cvdSeries[i] - cvdSeries[i - 1]);
  }
  const currentAcceleration = velocities.length >= 2
    ? velocities[velocities.length - 1] - velocities[velocities.length - 2]
    : 0;

  const lastBucket = orderflowBuckets[orderflowBuckets.length - 1];
  const currentDeltaPerTick = lastBucket.tradeCount > 0
    ? lastBucket.delta / lastBucket.tradeCount
    : 0;

  const vStd = ewma.velocityM2 > 0 ? Math.sqrt(ewma.velocityM2 / ewma.count) : 0;
  const aStd = ewma.accelerationM2 > 0 ? Math.sqrt(ewma.accelerationM2 / ewma.count) : 0;
  const dStd = ewma.deltaPerTickM2 > 0 ? Math.sqrt(ewma.deltaPerTickM2 / ewma.count) : 0;

  return {
    cvdVelocity_z: zScore(currentVelocity, ewma.velocityMean, vStd),
    cvdAcceleration_z: zScore(currentAcceleration, ewma.accelerationMean, aStd),
    deltaPerTick_z: zScore(currentDeltaPerTick, ewma.deltaPerTickMean, dStd),
  };
}

function extractInteraction(
  price: number,
  orderflowBuckets: OrderflowBucket[],
  binSize: number,
  correlationWindowMs: number,
): InteractionFeatures {
  if (orderflowBuckets.length < 5) {
    return { priceCvdCorrelation: 0, deltaAtPriceRatio: 1 };
  }

  const priceChanges: number[] = [];
  const cvdChanges: number[] = [];
  const bucketMs: number[] = [];
  let prevPrice = orderflowBuckets[0].close;

  for (const b of orderflowBuckets) {
    priceChanges.push(b.close - prevPrice);
    cvdChanges.push(b.delta);
    bucketMs.push(b.bucketMs);
    prevPrice = b.close;
  }

  const priceCvdCorrelation = computeTimeWindowCorrelation(
    priceChanges, cvdChanges, bucketMs, correlationWindowMs,
  );

  const deltaAtPriceRatio = computeDeltaAtPriceRatio(price, orderflowBuckets, binSize);

  return { priceCvdCorrelation, deltaAtPriceRatio };
}
