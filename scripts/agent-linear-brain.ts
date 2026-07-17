import { readOrderflowBuckets, readVolumeProfileBuckets } from "../packages/market-data";
import { parseVolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import { calculateCvd } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import { readMarketStructure } from "../packages/strategy-lab/reader/reader-structure/read-market-structure";
import { extractMachineNativeVector, type MachineNativeVector } from "../packages/strategy-lab/reader/reader-structure/machine-native-vector";
import type { VolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import type { CvdRead } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import type { MarketStructureRead } from "../packages/strategy-lab/reader/reader-structure/types";
import type { OrderflowBucket, VolumeProfileBucket } from "../packages/market-data/parquet/types";

type FeatureKey =
  | "distToNearestHVN_norm"
  | "distToNearestLVN_norm"
  | "distToPOC_norm"
  | "distToValueHigh_norm"
  | "distToValueLow_norm"
  | "volumeGradient"
  | "volumeROC"
  | "profileSkewness"
  | "volumeConcentration"
  | "cvdVelocity_z"
  | "cvdAcceleration_z"
  | "deltaPerTick_z"
  | "priceCvdCorrelation"
  | "deltaAtPriceRatio";

const FEATURE_KEYS: FeatureKey[] = [
  "distToNearestHVN_norm", "distToNearestLVN_norm", "distToPOC_norm",
  "distToValueHigh_norm", "distToValueLow_norm", "volumeGradient",
  "volumeROC", "profileSkewness", "volumeConcentration",
  "cvdVelocity_z", "cvdAcceleration_z", "deltaPerTick_z",
  "priceCvdCorrelation", "deltaAtPriceRatio",
];

export type AgentWeights = {
  features: Record<FeatureKey, number>;
  bias: number;
};

export function createZeroWeights(): AgentWeights {
  const features = {} as Record<FeatureKey, number>;
  for (const key of FEATURE_KEYS) features[key] = 0;
  return { features, bias: 0.1 };
}

function vectorToFlat(v: MachineNativeVector): number[] {
  return [
    v.spatial.distToNearestHVN_norm,
    v.spatial.distToNearestLVN_norm,
    v.spatial.distToPOC_norm,
    v.spatial.distToValueHigh_norm,
    v.spatial.distToValueLow_norm,
    v.spatial.volumeGradient,
    v.spatial.volumeROC,
    v.spatial.profileSkewness,
    v.spatial.volumeConcentration,
    v.flow.cvdVelocity_z,
    v.flow.cvdAcceleration_z,
    v.flow.deltaPerTick_z,
    v.interaction.priceCvdCorrelation,
    v.interaction.deltaAtPriceRatio,
  ];
}

function weightsToFlat(w: AgentWeights): number[] {
  return FEATURE_KEYS.map((k) => w.features[k]);
}

export function scoreEdge(vector: MachineNativeVector, weights: AgentWeights): number {
  const v = vectorToFlat(vector);
  const w = weightsToFlat(weights);
  let dot = 0;
  for (let i = 0; i < v.length; i++) dot += v[i] * w[i];
  return dot + weights.bias;
}

const L2_LAMBDA = 0.01;
const GRADIENT_CLIP_NORM = 5.0;

export function updateWeights(
  weights: AgentWeights,
  vector: MachineNativeVector,
  predictedScore: number,
  actualR: number,
  learningRate: number,
): AgentWeights {
  const error = actualR - predictedScore;
  const v = vectorToFlat(vector);
  const w = weightsToFlat(weights);

  const rawUpdate = [...v.map((vi) => learningRate * error * vi), learningRate * error];

  let updateNorm = 0;
  for (let i = 0; i < rawUpdate.length; i++) updateNorm += rawUpdate[i] ** 2;
  updateNorm = Math.sqrt(updateNorm);

  const scale = updateNorm > GRADIENT_CLIP_NORM ? GRADIENT_CLIP_NORM / updateNorm : 1;

  const newWeights = createZeroWeights();
  for (let i = 0; i < FEATURE_KEYS.length; i++) {
    const clipped = rawUpdate[i] * scale;
    newWeights.features[FEATURE_KEYS[i]] = w[i] + clipped - learningRate * L2_LAMBDA * w[i];
  }
  newWeights.bias = weights.bias + rawUpdate[rawUpdate.length - 1] * scale;
  return newWeights;
}

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

function windowKey(ms: number, intervalMs: number): string {
  return `${Math.floor(ms / intervalMs) * intervalMs}`;
}

function bisectLeft(arr: OrderflowBucket[], targetMs: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].bucketMs < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type SimTrade = {
  side: "long" | "short";
  entryPrice: number;
  entryAt: number;
  stop: number;
  initialStop: number;
  target: number;
  exitPrice: number | null;
  exitAt: number | null;
  r: number | null;
  vector: MachineNativeVector;
};

function runMonth(
  asset: string,
  startMs: number,
  endMs: number,
  profilesByWindow: Map<string, VolumeProfileBucket[]>,
  orderflowBuckets: OrderflowBucket[],
  weights: AgentWeights,
  learningRate: number,
  updateWeightsDuringMonth: boolean,
  scoreThreshold: number = 0,
): { trades: SimTrade[]; finalWeights: AgentWeights } {
  const trades: SimTrade[] = [];
  let openTrade: SimTrade | null = null;
  let structure: VolumeProfileStructure | null = null;
  let currentWeights = { ...weights, features: { ...weights.features } };

  const readIntervalMs = 60000;
  const orderflowWindowMs = 120000;

  let currentReadMs = startMs;
  while (currentReadMs <= endMs) {
    const prevWindowKey = windowKey(currentReadMs - 300000, 300000);
    const closedProfiles = profilesByWindow.get(prevWindowKey) ?? [];
    if (closedProfiles.length > 0) {
      structure = parseVolumeProfileStructure({ buckets: closedProfiles });
    }

    const ofStart = currentReadMs - orderflowWindowMs;
    const lo = bisectLeft(orderflowBuckets, ofStart);
    const hi = bisectLeft(orderflowBuckets, currentReadMs);
    const windowOrderflow = orderflowBuckets.slice(lo, hi);
    const cvd = calculateCvd(windowOrderflow);

    const lastBucket = windowOrderflow[windowOrderflow.length - 1];
    const currentPrice = lastBucket?.close ?? null;

    if (currentPrice !== null && structure !== null) {
      const read = readMarketStructure({
        asset,
        timestampMs: currentReadMs,
        profileBuckets: closedProfiles,
        orderflowBuckets: windowOrderflow,
        price: currentPrice,
      });

      if (openTrade) {
        openTrade = updateSimTrade(openTrade, currentPrice, currentReadMs);
        if (openTrade.exitPrice !== null) {
          if (updateWeightsDuringMonth && openTrade.r !== null) {
            currentWeights = updateWeights(
              currentWeights,
              openTrade.vector,
              scoreEdge(openTrade.vector, currentWeights),
              openTrade.r,
              learningRate,
            );
          }
          trades.push(openTrade);
          openTrade = null;
        }
      } else {
        const signal = evaluateSimSignal(currentPrice, currentReadMs, structure, cvd, read);
        if (signal) {
          const score = scoreEdge(read.vector, currentWeights);
          if (score > scoreThreshold) {
            signal.vector = read.vector;
            openTrade = signal;
          }
        }
      }
    }

    currentReadMs += readIntervalMs;
  }

  if (openTrade && openTrade.exitPrice === null) {
    openTrade.exitPrice = openTrade.entryPrice;
    openTrade.exitAt = currentReadMs;
    openTrade.r = 0;
    trades.push(openTrade);
  }

  return { trades, finalWeights: currentWeights };
}

function evaluateSimSignal(
  price: number,
  nowMs: number,
  structure: VolumeProfileStructure,
  cvd: CvdRead | null,
  read: MarketStructureRead,
): SimTrade | null {
  if (read.action === "rotating") return null;
  if (read.location === "at-poc") return null;

  const binSize = structure.bins[0] ? structure.bins[0].high - structure.bins[0].low : 1;
  const minRisk = binSize * 5;

  const atLvn = structure.lvn.find((n) => price >= n.low && price <= n.high);
  const atHvn = structure.hvn.find((n) => price >= n.low && price <= n.high);

  if (atLvn && cvd) {
    if (cvd.cvdTrend === "rising" && cvd.priceCvdDivergence !== "bearish") {
      const stop = atLvn.low - binSize;
      const risk = price - stop;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target > price && (target - price) / risk >= 1.5) {
        return { side: "long", entryPrice: price, entryAt: nowMs, stop, initialStop: stop, target, exitPrice: null, exitAt: null, r: null, vector: { spatial: {} as any, flow: {} as any, interaction: {} as any } };
      }
    }
    if (cvd.cvdTrend === "falling" && cvd.priceCvdDivergence !== "bullish") {
      const stop = atLvn.high + binSize;
      const risk = stop - price;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target < price && (price - target) / risk >= 1.5) {
        return { side: "short", entryPrice: price, entryAt: nowMs, stop, initialStop: stop, target, exitPrice: null, exitAt: null, r: null, vector: { spatial: {} as any, flow: {} as any, interaction: {} as any } };
      }
    }
  }

  if (atHvn && cvd) {
    const isNearValueHigh = Math.abs(price - structure.valueAreaHigh) < binSize * 2;
    const isNearValueLow = Math.abs(price - structure.valueAreaLow) < binSize * 2;

    if (isNearValueHigh && cvd.priceCvdDivergence === "bearish") {
      const stop = atHvn.high + binSize;
      const risk = stop - price;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target < price && (price - target) / risk >= 1.5) {
        return { side: "short", entryPrice: price, entryAt: nowMs, stop, initialStop: stop, target, exitPrice: null, exitAt: null, r: null, vector: { spatial: {} as any, flow: {} as any, interaction: {} as any } };
      }
    }

    if (isNearValueLow && cvd.priceCvdDivergence === "bullish") {
      const stop = atHvn.low - binSize;
      const risk = price - stop;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target > price && (target - price) / risk >= 1.5) {
        return { side: "long", entryPrice: price, entryAt: nowMs, stop, initialStop: stop, target, exitPrice: null, exitAt: null, r: null, vector: { spatial: {} as any, flow: {} as any, interaction: {} as any } };
      }
    }
  }

  return null;
}

const FEE_RATE = 0.0006;
const SLIPPAGE_RATE = 0.00015;
const COST_PER_SIDE = FEE_RATE + SLIPPAGE_RATE;
const NOTIONAL_SIZE_USD = 100;

function computeCostR(risk: number): number {
  if (risk <= 0) return 0;
  const totalCost = COST_PER_SIDE * 2 * NOTIONAL_SIZE_USD;
  return totalCost / risk;
}

function updateSimTrade(trade: SimTrade, currentPrice: number, nowMs: number): SimTrade {
  const initialRisk = Math.abs(trade.entryPrice - trade.initialStop);
  const trailTrigger = initialRisk * 0.5;

  if (trade.side === "long") {
    if (currentPrice <= trade.stop) {
      const risk = Math.abs(trade.entryPrice - trade.stop);
      if (risk <= 0) return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
      const costR = computeCostR(initialRisk);
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 - costR };
    }
    if (currentPrice >= trade.target) {
      const risk = Math.abs(trade.entryPrice - trade.stop);
      if (risk <= 0) return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: -1 };
      const costR = computeCostR(initialRisk);
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.target - trade.entryPrice) / risk - costR };
    }
    if (currentPrice >= trade.entryPrice + trailTrigger) {
      const newStop = Math.max(trade.stop, trade.entryPrice + initialRisk * 0.25);
      if (trade.stop < newStop) {
        return { ...trade, stop: newStop };
      }
    }
  } else {
    if (currentPrice >= trade.stop) {
      const risk = Math.abs(trade.entryPrice - trade.stop);
      if (risk <= 0) return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
      const costR = computeCostR(initialRisk);
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 - costR };
    }
    if (currentPrice <= trade.target) {
      const risk = Math.abs(trade.entryPrice - trade.stop);
      if (risk <= 0) return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: -1 };
      const costR = computeCostR(initialRisk);
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.entryPrice - trade.target) / risk - costR };
    }
    if (currentPrice <= trade.entryPrice - trailTrigger) {
      const newStop = Math.min(trade.stop, trade.entryPrice - initialRisk * 0.25);
      if (trade.stop > newStop) {
        return { ...trade, stop: newStop };
      }
    }
  }

  return trade;
}

type MonthResult = {
  month: string;
  trades: number;
  wins: number;
  totalR: number;
  avgR: number;
  maxDD: number;
  winRate: number;
};

function summarizeMonth(label: string, trades: SimTrade[]): MonthResult {
  let wins = 0;
  let totalR = 0;
  let peakR = 0;
  let maxDD = 0;

  for (const t of trades) {
    const r = t.r ?? 0;
    if (r > 0) wins++;
    totalR += r;
    if (totalR > peakR) peakR = totalR;
    const dd = peakR - totalR;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    month: label,
    trades: trades.length,
    wins,
    totalR,
    avgR: trades.length > 0 ? totalR / trades.length : 0,
    maxDD,
    winRate: trades.length > 0 ? wins / trades.length : 0,
  };
}

async function main() {
  const learningRate = Number(arg("lr", "0.001"));
  const asset = "BTCUSDT";

  const allMonths = [
    { label: "May 2025", start: "2025-05-01", end: "2025-06-01" },
    { label: "Jun 2025", start: "2025-06-01", end: "2025-07-01" },
    { label: "Jul 2025", start: "2025-07-01", end: "2025-08-01" },
    { label: "Aug 2025", start: "2025-08-01", end: "2025-09-01" },
    { label: "Sep 2025", start: "2025-09-01", end: "2025-10-01" },
    { label: "Oct 2025", start: "2025-10-01", end: "2025-11-01" },
    { label: "Nov 2025", start: "2025-11-01", end: "2025-12-01" },
    { label: "Dec 2025", start: "2025-12-01", end: "2026-01-01" },
    { label: "Jan 2026", start: "2026-01-01", end: "2026-02-01" },
    { label: "Feb 2026", start: "2026-02-01", end: "2026-03-01" },
    { label: "Mar 2026", start: "2026-03-01", end: "2026-04-01" },
  ];
  const maxMonths = Number(arg("months", String(allMonths.length)));
  const months = allMonths.slice(0, maxMonths);

  console.log("=== WALK-FORWARD LINEAR AGENT ===");
  console.log(`Learning rate: ${learningRate}`);
  console.log(`Months: ${months[0].label} to ${months[months.length - 1].label}`);
  console.log("");

  const dataStart = Date.now();
  console.log("Loading all data...");

  const allStartMs = Date.parse(`${months[0].start}T00:00:00Z`);
  const allEndMs = Date.parse(`${months[months.length - 1].end}T23:59:59Z`);

  const profileBuckets = await readVolumeProfileBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs: allStartMs,
    endMs: allEndMs,
  });

  const orderflowBuckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs: allStartMs,
    endMs: allEndMs,
  });

  console.log(`Data loaded in ${((Date.now() - dataStart) / 1000).toFixed(1)}s`);
  console.log(`  Profiles: ${profileBuckets.length}, Orderflow: ${orderflowBuckets.length}`);
  console.log("");

  const profilesByWindow = new Map<string, VolumeProfileBucket[]>();
  for (const bucket of profileBuckets) {
    const key = windowKey(bucket.startMs, 300000);
    const existing = profilesByWindow.get(key);
    if (existing) existing.push(bucket);
    else profilesByWindow.set(key, [bucket]);
  }

  let weights = createZeroWeights();
  const oosResults: MonthResult[] = [];

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const startMs = Date.parse(`${m.start}T00:00:00Z`);
    const endMs = Date.parse(`${m.end}T23:59:59Z`);

    if (i === 0) {
      const monthStart = Date.now();
      const { finalWeights } = runMonth(
        asset, startMs, endMs, profilesByWindow, orderflowBuckets,
        weights, learningRate, true,
      );
      weights = finalWeights;
      const elapsed = ((Date.now() - monthStart) / 1000).toFixed(1);
      console.log(`[TRAIN] ${m.label.padEnd(12)} | initial weights → learned | ${elapsed}s`);
    } else {
      const oosStart = Date.now();
      const { trades: oosTrades } = runMonth(
        asset, startMs, endMs, profilesByWindow, orderflowBuckets,
        weights, learningRate, false, 0,
      );
      const oosResult = summarizeMonth(m.label, oosTrades);
      oosResults.push(oosResult);
      const oosElapsed = ((Date.now() - oosStart) / 1000).toFixed(1);

      const trainStart = Date.now();
      const { finalWeights } = runMonth(
        asset, startMs, endMs, profilesByWindow, orderflowBuckets,
        weights, learningRate, true,
      );
      weights = finalWeights;
      const trainElapsed = ((Date.now() - trainStart) / 1000).toFixed(1);

      console.log(
        `[OOS ] ${m.label.padEnd(12)} | ${String(oosResult.trades).padStart(4)} trades | ${(oosResult.winRate * 100).toFixed(0).padStart(3)}% win | ${oosResult.avgR.toFixed(2).padStart(7)} avg R | ${oosResult.totalR.toFixed(1).padStart(8)} total R | ${oosResult.maxDD.toFixed(1).padStart(5)} max DD | ${oosElapsed}s`,
      );
      console.log(
        `[TRN ] ${m.label.padEnd(12)} | weights updated for next month | ${trainElapsed}s`,
      );
    }
  }

  console.log("\n=== OUT-OF-SAMPLE SUMMARY ===");
  console.log("(Frozen weights from all prior training, no updates)");
  console.log("");
  console.log("Month           | Trades | Win%  | Avg R   | Total R | Max DD");
  console.log("----------------|--------|-------|---------|---------|-------");

  let oosTotalR = 0;
  let oosTotalTrades = 0;
  for (const r of oosResults) {
    oosTotalR += r.totalR;
    oosTotalTrades += r.trades;
    console.log(
      `${r.month.padEnd(15)} | ${String(r.trades).padStart(6)} | ${(r.winRate * 100).toFixed(0).padStart(4)}% | ${r.avgR.toFixed(2).padStart(7)} | ${r.totalR.toFixed(1).padStart(7)} | ${r.maxDD.toFixed(1).padStart(5)}`,
    );
  }

  console.log("");
  console.log(`OOS Total: ${oosTotalTrades} trades, ${oosTotalR.toFixed(1)} total R`);
  console.log(`OOS Avg:   ${(oosTotalR / oosResults.length).toFixed(2)} R/month`);

  const THRESHOLDS = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
  const octIndex = months.findIndex((m) => m.label === "Oct 2025");

  if (octIndex > 0) {
    console.log("\n=== THRESHOLD ANALYSIS: Oct 2025 ===");
    console.log("Frozen weights from May 2025-Sep 2025 training.");
    console.log("");
    console.log("Threshold | Trades | Win%  | Avg R   | Total R | Max DD");
    console.log("----------|--------|-------|---------|---------|-------");

    let frozenWeights = createZeroWeights();
    for (let j = 0; j < octIndex; j++) {
      const jm = months[j];
      const js = Date.parse(`${jm.start}T00:00:00Z`);
      const je = Date.parse(`${jm.end}T23:59:00Z`);
      const { finalWeights } = runMonth(
        asset, js, je, profilesByWindow, orderflowBuckets,
        frozenWeights, learningRate, true, 0,
      );
      frozenWeights = finalWeights;
    }

    const octM = months[octIndex];
    const octStartMs = Date.parse(`${octM.start}T00:00:00Z`);
    const octEndMs = Date.parse(`${octM.end}T23:59:00Z`);

    for (const threshold of THRESHOLDS) {
      const { trades } = runMonth(
        asset, octStartMs, octEndMs, profilesByWindow, orderflowBuckets,
        frozenWeights, learningRate, false, threshold,
      );
      const result = summarizeMonth(octM.label, trades);
      console.log(
        `  ${String(threshold).padStart(9)} | ${String(result.trades).padStart(6)} | ${(result.winRate * 100).toFixed(0).padStart(4)}% | ${result.avgR.toFixed(2).padStart(7)} | ${result.totalR.toFixed(1).padStart(7)} | ${result.maxDD.toFixed(1).padStart(5)}`,
      );
    }
  }

  console.log("\n=== FINAL WEIGHTS (after all training) ===");
  const finalSorted = FEATURE_KEYS
    .map((k) => ({ key: k, weight: weights.features[k] }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  console.log("  Feature                    | Weight");
  console.log("  ---------------------------|--------");
  for (const f of finalSorted) {
    console.log(`  ${f.key.padEnd(26)}| ${f.weight.toFixed(6)}`);
  }
  console.log(`  ${"bias".padEnd(26)}| ${weights.bias.toFixed(6)}`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
