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
  profileSkewness_z: number;
  volumeConcentration_z: number;
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

const EWMA_ALPHA = 2 / (3600 + 1);

function zScore(value: number, mean: number, std: number): number {
  return std > 0 ? (value - mean) / std : 0;
}

function ewmaUpdate(prev: number, current: number, alpha: number): number {
  return alpha * current + (1 - alpha) * prev;
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
  return skew;
}

function computeVolumeConcentration(structure: VolumeProfileStructure | null): number {
  if (!structure || structure.bins.length < 2 || structure.totalVolume <= 0) return 0;
  const maxVol = Math.max(...structure.bins.map((b) => b.volume));
  return maxVol / (structure.totalVolume / structure.bins.length);
}

function buildEwmaStats(buckets: OrderflowBucket[]): {
  velocityEwma: { mean: number; m2: number };
  accelerationEwma: { mean: number; m2: number };
  deltaPerTickEwma: { mean: number; m2: number };
} {
  const empty = { mean: 0, m2: 0 };
  if (buckets.length < 3) {
    return { velocityEwma: { ...empty }, accelerationEwma: { ...empty }, deltaPerTickEwma: { ...empty } };
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

  for (let i = 0; i < velocities.length; i++) {
    count++;
    const v = velocities[i];
    const delta = v - vMean;
    vMean += delta / count;
    vM2 += delta * (v - vMean);

    if (i < accelerations.length) {
      const a = accelerations[i];
      const aDelta = a - aMean;
      aMean += aDelta / count;
      aM2 += aDelta * (a - aMean);
    }

    if (i < deltaPerTicks.length) {
      const d = deltaPerTicks[i];
      const dDelta = d - dMean;
      dMean += dDelta / count;
      dM2 += dDelta * (d - dMean);
    }
  }

  return {
    velocityEwma: { mean: vMean, m2: vM2 },
    accelerationEwma: { mean: aMean, m2: aM2 },
    deltaPerTickEwma: { mean: dMean, m2: dM2 },
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
  return den > 0 ? num / den : 0;
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

  return currentDelta / (Math.abs(previousDelta) + EPSILON);
}

export function extractMachineNativeVector(
  price: number,
  structure: VolumeProfileStructure | null,
  orderflowBuckets: OrderflowBucket[],
): MachineNativeVector {
  const ATR_WINDOW = 20;
  const CORRELATION_WINDOW_MS = 900000;

  const atr = computeATR(orderflowBuckets, ATR_WINDOW);
  const binSize = structure?.bins[0]
    ? structure.bins[0].high - structure.bins[0].low
    : 1;

  const spatial = extractSpatial(price, structure, orderflowBuckets, atr);
  const flow = extractFlow(orderflowBuckets);
  const interaction = extractInteraction(price, orderflowBuckets, binSize, CORRELATION_WINDOW_MS);

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
      profileSkewness_z: 0,
      volumeConcentration_z: 0,
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

  const profileSkewness = computeProfileSkewness(structure);
  const volumeConcentration = computeVolumeConcentration(structure);

  return {
    distToNearestHVN_atr: distToNearestHVN / atr,
    distToNearestLVN_atr: distToNearestLVN / atr,
    distToPOC_atr: distToPOC / atr,
    distToValueHigh_atr: distToValueHigh / atr,
    distToValueLow_atr: distToValueLow / atr,
    volumeGradient,
    volumeROC,
    profileSkewness_z: profileSkewness,
    volumeConcentration_z: volumeConcentration,
  };
}

function extractFlow(orderflowBuckets: OrderflowBucket[]): FlowFeatures {
  if (orderflowBuckets.length < 3) {
    return { cvdVelocity_z: 0, cvdAcceleration_z: 0, deltaPerTick_z: 0 };
  }

  const ewma = buildEwmaStats(orderflowBuckets);

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

  const vStd = ewma.velocityEwma.m2 > 0
    ? Math.sqrt(ewma.velocityEwma.m2 / orderflowBuckets.length)
    : 0;
  const aStd = ewma.accelerationEwma.m2 > 0
    ? Math.sqrt(ewma.accelerationEwma.m2 / orderflowBuckets.length)
    : 0;
  const dStd = ewma.deltaPerTickEwma.m2 > 0
    ? Math.sqrt(ewma.deltaPerTickEwma.m2 / orderflowBuckets.length)
    : 0;

  return {
    cvdVelocity_z: zScore(currentVelocity, ewma.velocityEwma.mean, vStd),
    cvdAcceleration_z: zScore(currentAcceleration, ewma.accelerationEwma.mean, aStd),
    deltaPerTick_z: zScore(currentDeltaPerTick, ewma.deltaPerTickEwma.mean, dStd),
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
    priceChanges,
    cvdChanges,
    bucketMs,
    correlationWindowMs,
  );

  const deltaAtPriceRatio = computeDeltaAtPriceRatio(price, orderflowBuckets, binSize);

  return { priceCvdCorrelation, deltaAtPriceRatio };
}
