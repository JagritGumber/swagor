import { readOrderflowBuckets, readVolumeProfileBuckets } from "../packages/market-data";
import { parseVolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import { calculateCvd } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import { readMarketStructure } from "../packages/strategy-lab/reader/reader-structure/read-market-structure";
import type { VolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import type { CvdRead } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import type { MarketStructureRead, MarketStructureAction, MarketStructureLocation } from "../packages/strategy-lab/reader/reader-structure/types";
import type { OrderflowBucket, VolumeProfileBucket } from "../packages/market-data/parquet/types";

type TradeSide = "long" | "short";

type EntryContext = {
  action: MarketStructureAction;
  location: MarketStructureLocation;
  absorption: boolean;
  nearestNode: {
    kind: "hvn" | "lvn" | "poc";
    low: number;
    high: number;
    mid: number;
    volume: number;
  } | null;
  cvd: {
    cvd: number;
    cvdHigh: number;
    cvdLow: number;
    cvdTrend: "rising" | "falling" | "flat";
    priceCvdDivergence: "bullish" | "bearish" | "none";
    lastPrice: number;
    firstPrice: number;
    priceChange: number;
  } | null;
  narrative: string;
  binSize: number;
  priceDistanceToPoc: number;
  priceDistanceToValueHigh: number;
  priceDistanceToValueLow: number;
  profileRange: number;
  isLvn: boolean;
  isHvn: boolean;
};

type Trade = {
  side: TradeSide;
  entryPrice: number;
  entryAt: number;
  stop: number;
  target: number;
  exitPrice: number | null;
  exitAt: number | null;
  r: number | null;
  entryContext: EntryContext;
  previousAction: MarketStructureAction | null;
  pocSnapshots: { ms: number; poc: number; price: number }[];
  temporal: TemporalFeatures;
  eventSequence: EventSequence;
};

type TemporalFeatures = {
  cvdSlope: number;
  cvdAcceleration: number;
  cvdSignChanges: number;
  cvdLongestRun: number;
  cvdImpulseCount: number;
  cvdAvgImpulse: number;
  priceVelocity: number;
  priceAcceleration: number;
  priceLargestImpulse: number;
  priceRetracement: number;
  buySellRatio: number;
  volumeSlope: number;
  tradeRate: number;
  deltaPersistence: number;
  upCloseRatio: number;
};

type MarketEvent = {
  type: string;
  side: "buy" | "sell" | "neutral";
  ms: number;
  magnitude: number;
};

type EventSequence = {
  events: MarketEvent[];
  eventString: string;
};

type ConditionStats = {
  condition: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
};

type WinLossAnalysis = {
  conditions: ConditionStats[];
};

type BacktestConfig = {
  noRejecting: boolean;
  discoveringOnly: boolean;
  bullishDiv: boolean;
  noTrail: boolean;
  streakAnalysis: boolean;
  stateAnalysis: boolean;
  transitionAnalysis: boolean;
  featureAnalysis: boolean;
  responseCurves: boolean;
  explainPoc: boolean;
  pocMigration: boolean;
  pocFailure: boolean;
  cvdFilter: boolean;
  cvdDistribution: boolean;
  temporalAnalysis: boolean;
  eventAnalysis: boolean;
  decileContrast: boolean;
  decisionTree: boolean;
};

type DirectionStats = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  maxDD: number;
};

type BacktestResult = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  trades: Trade[];
  winLossAnalysis: WinLossAnalysis;
  long: DirectionStats;
  short: DirectionStats;
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const start = arg("start", "2025-05-01");
const end = arg("end", "2025-06-01");
const startMs = Date.parse(`${start}T00:00:00Z`);
const endMs = Date.parse(`${end}T23:59:59Z`);
const readIntervalMs = Number(arg("interval", "60000"));
const orderflowWindowMs = Number(arg("orderflow-window", "120000"));

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);
const config: BacktestConfig = {
  noRejecting: hasFlag("no-rejecting"),
  discoveringOnly: hasFlag("discovering-only"),
  bullishDiv: hasFlag("bullish-div"),
  noTrail: hasFlag("no-trail"),
  streakAnalysis: hasFlag("streak-analysis"),
  stateAnalysis: hasFlag("state-analysis"),
  transitionAnalysis: hasFlag("transition-analysis"),
  featureAnalysis: hasFlag("feature-analysis"),
  responseCurves: hasFlag("response-curves"),
  explainPoc: hasFlag("explain-poc"),
  pocMigration: hasFlag("poc-migration"),
  pocFailure: hasFlag("poc-failure"),
  cvdFilter: hasFlag("cvd-filter"),
  cvdDistribution: hasFlag("cvd-distribution"),
  temporalAnalysis: hasFlag("temporal-analysis"),
  eventAnalysis: hasFlag("event-analysis"),
  decileContrast: hasFlag("decile-contrast"),
  decisionTree: hasFlag("decision-tree"),
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const filters = Object.entries(config)
    .filter(([, v]) => v)
    .map(([k]) => k);
  console.log(`Market Structure Backtest: ${start} to ${end}`);
  console.log(`Read interval: ${readIntervalMs / 1000}s, Orderflow window: ${orderflowWindowMs / 1000}s`);
  if (filters.length > 0) console.log(`Filters: ${filters.join(", ")}`);
  const overallStart = Date.now();

  const asset = "BTCUSDT";

  console.log("\nLoading data...");
  const dataStart = Date.now();

  const profileBuckets = await readVolumeProfileBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  console.log(`  Profile buckets: ${profileBuckets.length}`);

  const orderflowBuckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  console.log(`  Orderflow buckets: ${orderflowBuckets.length}`);
  console.log(`Data loaded in ${((Date.now() - dataStart) / 1000).toFixed(1)}s`);

  const profilesByWindow = groupProfileBuckets(profileBuckets);

  const result = runBacktest({
    asset,
    profilesByWindow,
    orderflowBuckets,
    startMs,
    endMs,
    readIntervalMs,
    orderflowWindowMs,
    config,
  });

  printResult(result);
  if (config.streakAnalysis) {
    const streakReports = analyzeStreaks(result.trades);
    printStreakAnalysis(streakReports);
  }
  if (config.stateAnalysis) {
    const stateReport = analyzeStateEvolution(result.trades);
    printStateAnalysis(stateReport);
  }
  if (config.transitionAnalysis) {
    const allTransReport = analyzeAllTransitions(result.trades);
    printAllTransitionAnalysis(allTransReport);
  }
  if (config.featureAnalysis) {
    const featureReport = analyzeFeatureDiscrimination(result.trades, 20);
    printFeatureAnalysis(featureReport);
  }
  if (config.responseCurves) {
    const curves = analyzeResponseCurves(result.trades);
    printResponseCurves(curves);
  }
  if (config.explainPoc) {
    analyzeAndExplainPoc(result.trades);
  }
  if (config.pocMigration) {
    analyzePocMigration(result.trades);
  }
  if (config.pocFailure) {
    analyzePocFailure(result.trades);
  }
  if (config.cvdFilter) {
    analyzeCvdFilter(result.trades);
  }
  if (config.cvdDistribution) {
    analyzeCvdDistribution(result.trades);
  }
  if (config.temporalAnalysis) {
    analyzeTemporalFeatures(result.trades);
  }
  if (config.eventAnalysis) {
    analyzeEventSequences(result.trades);
  }
  if (config.decileContrast) {
    analyzeDecileContrast(result.trades);
  }
  if (config.decisionTree) {
    analyzeDecisionTree(result.trades);
  }
  console.log(`\nTotal elapsed: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);
}

function groupProfileBuckets(buckets: VolumeProfileBucket[]): Map<string, VolumeProfileBucket[]> {
  const map = new Map<string, VolumeProfileBucket[]>();
  for (const bucket of buckets) {
    const key = windowKey(bucket.startMs, 300000);
    const existing = map.get(key);
    if (existing) {
      existing.push(bucket);
    } else {
      map.set(key, [bucket]);
    }
  }
  return map;
}

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

function runBacktest(input: {
  asset: string;
  profilesByWindow: Map<string, VolumeProfileBucket[]>;
  orderflowBuckets: OrderflowBucket[];
  startMs: number;
  endMs: number;
  readIntervalMs: number;
  orderflowWindowMs: number;
  config: BacktestConfig;
}): BacktestResult {
  const trades: Trade[] = [];
  let openTrade: Trade | null = null;
  let structure: VolumeProfileStructure | null = null;
  let lastAction: MarketStructureAction | null = null;

  let currentReadMs = input.startMs;
  while (currentReadMs <= input.endMs) {
    const prevWindowKey = windowKey(currentReadMs - 300000, 300000);
    const closedProfiles = input.profilesByWindow.get(prevWindowKey) ?? [];
    if (closedProfiles.length > 0) {
      structure = parseVolumeProfileStructure({ buckets: closedProfiles });
    }

    const ofStart = currentReadMs - input.orderflowWindowMs;
    const lo = bisectLeft(input.orderflowBuckets, ofStart);
    const hi = bisectLeft(input.orderflowBuckets, currentReadMs);
    const windowOrderflow = input.orderflowBuckets.slice(lo, hi);
    const cvd = calculateCvd(windowOrderflow);

    const lastBucket = windowOrderflow[windowOrderflow.length - 1];
    const currentPrice = lastBucket?.close ?? null;

    if (currentPrice !== null && structure !== null) {
      const read = readMarketStructure({
        asset: input.asset,
        timestampMs: currentReadMs,
        profileBuckets: closedProfiles,
        orderflowBuckets: windowOrderflow,
        price: currentPrice,
      });

      if (openTrade) {
        openTrade = updateTrade(openTrade, currentPrice, currentReadMs, structure, cvd, input.config.noTrail);
        if (openTrade.exitPrice !== null) {
          trades.push(openTrade);
          lastAction = openTrade.entryContext.action;
          openTrade = null;
        } else {
          const lastSnap = openTrade.pocSnapshots[openTrade.pocSnapshots.length - 1];
          if (currentReadMs - lastSnap.ms >= 300000) {
            openTrade.pocSnapshots.push({ ms: currentReadMs, poc: structure.poc, price: currentPrice });
          }
        }
      } else {
        const signal = evaluateSignal(currentPrice, currentReadMs, structure, cvd, read, input.config, windowOrderflow);
        if (signal) {
          signal.previousAction = lastAction;
          openTrade = signal;
        }
      }
    }

    currentReadMs += input.readIntervalMs;
  }

  if (openTrade && openTrade.exitPrice === null) {
    openTrade.exitPrice = openTrade.entryPrice;
    openTrade.exitAt = currentReadMs;
    openTrade.r = 0;
    trades.push(openTrade);
  }

  return summarizeTrades(trades);
}

function computeTemporalFeatures(buckets: OrderflowBucket[]): TemporalFeatures {
  const empty: TemporalFeatures = {
    cvdSlope: 0, cvdAcceleration: 0, cvdSignChanges: 0, cvdLongestRun: 0,
    cvdImpulseCount: 0, cvdAvgImpulse: 0, priceVelocity: 0, priceAcceleration: 0,
    priceLargestImpulse: 0, priceRetracement: 0, buySellRatio: 0, volumeSlope: 0,
    tradeRate: 0, deltaPersistence: 0, upCloseRatio: 0,
  };
  if (buckets.length < 3) return empty;

  // CVD series
  const deltas = buckets.map((b) => b.delta);
  let cumDelta = 0;
  const cvdSeries: number[] = [];
  for (const d of deltas) {
    cumDelta += d;
    cvdSeries.push(cumDelta);
  }

  // CVD slope: linear regression slope of CVD over time
  const n = cvdSeries.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = cvdSeries.reduce((s, x) => s + x, 0) / n;
  let numSlope = 0;
  let denSlope = 0;
  for (let i = 0; i < n; i++) {
    numSlope += (xs[i] - xMean) * (cvdSeries[i] - yMean);
    denSlope += (xs[i] - xMean) ** 2;
  }
  const cvdSlope = denSlope > 0 ? numSlope / denSlope : 0;

  // CVD acceleration: slope of the slope (split into halves, compare)
  const half = Math.floor(n / 2);
  const firstHalf = cvdSeries.slice(0, half);
  const secondHalf = cvdSeries.slice(half);
  const slopeOf = (arr: number[]): number => {
    if (arr.length < 2) return 0;
    const xm = (arr.length - 1) / 2;
    const ym = arr.reduce((s, x) => s + x, 0) / arr.length;
    let ns = 0;
    let ds = 0;
    for (let i = 0; i < arr.length; i++) {
      ns += (i - xm) * (arr[i] - ym);
      ds += (i - xm) ** 2;
    }
    return ds > 0 ? ns / ds : 0;
  };
  const cvdAcceleration = slopeOf(secondHalf) - slopeOf(firstHalf);

  // CVD sign changes
  let signChanges = 0;
  for (let i = 1; i < deltas.length; i++) {
    if ((deltas[i] > 0 && deltas[i - 1] <= 0) || (deltas[i] <= 0 && deltas[i - 1] > 0)) {
      signChanges++;
    }
  }

  // CVD longest run (consecutive same-sign deltas)
  let longestRun = 0;
  let curRun = 1;
  for (let i = 1; i < deltas.length; i++) {
    if ((deltas[i] > 0) === (deltas[i - 1] > 0)) {
      curRun++;
    } else {
      if (curRun > longestRun) longestRun = curRun;
      curRun = 1;
    }
  }
  if (curRun > longestRun) longestRun = curRun;

  // CVD impulse analysis: consecutive same-sign runs with size
  const impulses: number[] = [];
  let runStart = 0;
  for (let i = 1; i <= deltas.length; i++) {
    if (i === deltas.length || (deltas[i] > 0) !== (deltas[i - 1] > 0)) {
      const runDeltas = deltas.slice(runStart, i);
      const impulseSize = runDeltas.reduce((s, x) => s + Math.abs(x), 0);
      impulses.push(deltas[runStart] > 0 ? impulseSize : -impulseSize);
      runStart = i;
    }
  }
  const cvdImpulseCount = impulses.length;
  const cvdAvgImpulse = impulses.length > 0 ? impulses.reduce((s, x) => s + Math.abs(x), 0) / impulses.length : 0;

  // Price features
  const prices = buckets.map((b) => b.close);
  const priceVelocity = (prices[prices.length - 1] - prices[0]) / prices.length;
  const priceFirstHalf = prices.slice(0, half);
  const priceSecondHalf = prices.slice(half);
  const velFirst = priceFirstHalf.length > 1 ? (priceFirstHalf[priceFirstHalf.length - 1] - priceFirstHalf[0]) / priceFirstHalf.length : 0;
  const velSecond = priceSecondHalf.length > 1 ? (priceSecondHalf[priceSecondHalf.length - 1] - priceSecondHalf[0]) / priceSecondHalf.length : 0;
  const priceAcceleration = velSecond - velFirst;

  // Price largest impulse: biggest single-direction move
  let largestImpulse = 0;
  let curImpulse = 0;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (Math.sign(diff) === Math.sign(curImpulse) || curImpulse === 0) {
      curImpulse += diff;
    } else {
      if (Math.abs(curImpulse) > Math.abs(largestImpulse)) largestImpulse = curImpulse;
      curImpulse = diff;
    }
  }
  if (Math.abs(curImpulse) > Math.abs(largestImpulse)) largestImpulse = curImpulse;

  // Price retracement: max retraction from peak/trough
  const priceHigh = Math.max(...prices);
  const priceLow = Math.min(...prices);
  const priceRange = priceHigh - priceLow;
  let maxRetrace = 0;
  let peak = prices[0];
  let trough = prices[0];
  for (const p of prices) {
    if (p > peak) peak = p;
    if (p < trough) trough = p;
    const retraceFromPeak = peak - p;
    const retraceFromTrough = p - trough;
    if (retraceFromPeak > maxRetrace) maxRetrace = retraceFromPeak;
    if (retraceFromTrough > maxRetrace) maxRetrace = retraceFromTrough;
  }
  const priceRetracement = priceRange > 0 ? maxRetrace / priceRange : 0;

  // Buy/sell ratio
  const totalBuy = buckets.reduce((s, b) => s + b.buyVolume, 0);
  const totalSell = buckets.reduce((s, b) => s + b.sellVolume, 0);
  const buySellRatio = totalSell > 0 ? totalBuy / totalSell : totalBuy > 0 ? 10 : 0;

  // Volume slope
  const volumes = buckets.map((b) => b.buyVolume + b.sellVolume);
  const vMean = volumes.reduce((s, x) => s + x, 0) / volumes.length;
  let vNum = 0;
  let vDen = 0;
  for (let i = 0; i < volumes.length; i++) {
    vNum += (i - xMean) * (volumes[i] - vMean);
    vDen += (i - xMean) ** 2;
  }
  const volumeSlope = vDen > 0 ? vNum / vDen : 0;

  // Trade rate (trades per bucket)
  const totalTrades = buckets.reduce((s, b) => s + b.tradeCount, 0);
  const tradeRate = totalTrades / buckets.length;

  // Delta persistence: fraction of buckets with same sign as overall delta
  const overallDelta = deltas.reduce((s, x) => s + x, 0);
  const deltaPersistence = deltas.length > 0 ? deltas.filter((d) => Math.sign(d) === Math.sign(overallDelta)).length / deltas.length : 0;

  // Up close ratio
  const upCloses = buckets.filter((b) => b.close >= b.open).length;
  const upCloseRatio = buckets.length > 0 ? upCloses / buckets.length : 0;

  return {
    cvdSlope, cvdAcceleration, cvdSignChanges: signChanges, cvdLongestRun: longestRun,
    cvdImpulseCount, cvdAvgImpulse, priceVelocity, priceAcceleration,
    priceLargestImpulse: largestImpulse, priceRetracement, buySellRatio,
    volumeSlope, tradeRate, deltaPersistence, upCloseRatio,
  };
}

function detectEvents(buckets: OrderflowBucket[]): EventSequence {
  const events: MarketEvent[] = [];
  if (buckets.length < 3) return { events, eventString: "" };

  // State tracking
  let impulseSide: "buy" | "sell" | "neutral" = "neutral";
  let impulseStart = 0;
  let impulseSize = 0;
  let lastImpulseSide: "buy" | "sell" | "neutral" = "neutral";
  let tradeRatePrev = 0;
  let pricePrev = buckets[0].close;
  let cvdPrev = 0;
  let cumDelta = 0;
  const IMPULSE_THRESHOLD = 3;
  const EXHAUSTION_THRESHOLD = 0.3;

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    const delta = b.delta;
    const price = b.close;
    cumDelta += delta;

    // Detect impulse start
    if (impulseSide === "neutral") {
      if (delta >= IMPULSE_THRESHOLD) {
        impulseSide = "buy";
        impulseStart = i;
        impulseSize = delta;
        events.push({ type: "IMPULSE_START", side: "buy", ms: b.bucketMs, magnitude: delta });
      } else if (delta <= -IMPULSE_THRESHOLD) {
        impulseSide = "sell";
        impulseStart = i;
        impulseSize = Math.abs(delta);
        events.push({ type: "IMPULSE_START", side: "sell", ms: b.bucketMs, magnitude: Math.abs(delta) });
      }
    } else {
      // Continue impulse
      const sameDirection = (impulseSide === "buy" && delta > 0) || (impulseSide === "sell" && delta < 0);
      if (sameDirection) {
        impulseSize += Math.abs(delta);
      } else {
        // Impulse interrupted
        if (impulseSize >= IMPULSE_THRESHOLD * 3) {
          const exhaustionRatio = Math.abs(delta) / (impulseSize / (i - impulseStart + 1));
          if (exhaustionRatio >= EXHAUSTION_THRESHOLD) {
            events.push({ type: "EXHAUSTION", side: impulseSide === "buy" ? "sell" : "buy", ms: b.bucketMs, magnitude: exhaustionRatio });
          }
        }
        // Check for reversal
        if (Math.abs(delta) >= IMPULSE_THRESHOLD) {
          if ((impulseSide === "buy" && delta < -IMPULSE_THRESHOLD) ||
              (impulseSide === "sell" && delta > IMPULSE_THRESHOLD)) {
            events.push({ type: "REVERSAL", side: impulseSide === "buy" ? "sell" : "buy", ms: b.bucketMs, magnitude: Math.abs(delta) });
          }
          lastImpulseSide = impulseSide;
          impulseSide = delta > 0 ? "buy" : "sell";
          impulseStart = i;
          impulseSize = Math.abs(delta);
          events.push({ type: "IMPULSE_START", side: impulseSide, ms: b.bucketMs, magnitude: Math.abs(delta) });
        } else {
          // Weak counter-move: absorption
          if (Math.abs(delta) > 0 && Math.abs(delta) < IMPULSE_THRESHOLD) {
            events.push({ type: "ABSORPTION", side: impulseSide, ms: b.bucketMs, magnitude: Math.abs(delta) });
          }
          impulseSide = "neutral";
          impulseSize = 0;
        }
      }
    }

    // Detect trade rate changes
    const tradeRate = b.tradeCount;
    if (i > 0 && tradeRatePrev > 0) {
      const rateRatio = tradeRate / tradeRatePrev;
      if (rateRatio > 1.5 && tradeRate > 5) {
        events.push({ type: "RATE_EXPANDS", side: "neutral", ms: b.bucketMs, magnitude: rateRatio });
      } else if (rateRatio < 0.6 && tradeRatePrev > 5) {
        events.push({ type: "RATE_CONTRACTS", side: "neutral", ms: b.bucketMs, magnitude: rateRatio });
      }
    }
    tradeRatePrev = tradeRate;

    // Detect pullbacks (price retraces after move)
    if (i > 2) {
      const recentPrices = buckets.slice(Math.max(0, i - 2), i + 1).map((x) => x.close);
      const recentHigh = Math.max(...recentPrices);
      const recentLow = Math.min(...recentPrices);
      const recentRange = recentHigh - recentLow;
      if (recentRange > 0) {
        const isRetrace = (lastImpulseSide === "buy" && price < recentHigh - recentRange * 0.5) ||
                         (lastImpulseSide === "sell" && price > recentLow + recentRange * 0.5);
        if (isRetrace && events.length > 0) {
          const lastEvt = events[events.length - 1];
          if (lastEvt.type !== "PULLBACK" && lastEvt.ms !== b.bucketMs) {
            events.push({ type: "PULLBACK", side: lastImpulseSide === "buy" ? "sell" : "buy", ms: b.bucketMs, magnitude: recentRange });
          }
        }
      }
    }

    // Detect acceptance (price moves toward POC direction, low volatility)
    if (i > 0) {
      const priceDelta = Math.abs(price - pricePrev);
      const isLowVol = priceDelta < 2;
      if (isLowVol && events.length > 0) {
        const lastEvt = events[events.length - 1];
        if (lastEvt.type !== "ACCEPTANCE" && lastEvt.ms !== b.bucketMs) {
          events.push({ type: "ACCEPTANCE", side: "neutral", ms: b.bucketMs, magnitude: 1 });
        }
      }
    }

    pricePrev = price;
    cvdPrev = cumDelta;
  }

  // Build event string
  const eventString = events.map((e) => e.side !== "neutral" ? e.side[0].toUpperCase() + "_" + e.type : e.type).join(" -> ");

  return { events, eventString };
}

function evaluateSignal(
  price: number,
  nowMs: number,
  structure: VolumeProfileStructure,
  cvd: CvdRead | null,
  read: MarketStructureRead,
  config: BacktestConfig,
  windowOrderflow: OrderflowBucket[],
): Trade | null {
  if (read.action === "rotating") return null;
  if (read.location === "at-poc") return null;
  if (config.noRejecting && read.action === "rejecting") return null;
  if (config.discoveringOnly && read.action !== "discovering") return null;
  if (config.bullishDiv && (!cvd || cvd.priceCvdDivergence !== "bullish")) return null;

  const temporal = computeTemporalFeatures(windowOrderflow);
  const eventSequence = detectEvents(windowOrderflow);
  const binSize = structure.bins[0] ? structure.bins[0].high - structure.bins[0].low : 1;
  const minRisk = binSize * 5;

  const atLvn = structure.lvn.find((n) => price >= n.low && price <= n.high);
  const atHvn = structure.hvn.find((n) => price >= n.low && price <= n.high);

  const entryContext: EntryContext = {
    action: read.action,
    location: read.location,
    absorption: read.absorption,
    nearestNode: read.nearestNode,
    cvd: read.cvd,
    narrative: read.narrative,
    binSize,
    priceDistanceToPoc: Math.abs(price - structure.poc),
    priceDistanceToValueHigh: Math.abs(price - structure.valueAreaHigh),
    priceDistanceToValueLow: Math.abs(price - structure.valueAreaLow),
    profileRange: structure.profileHigh - structure.profileLow,
    isLvn: !!atLvn,
    isHvn: !!atHvn,
  };

  if (atLvn && cvd) {
    if (cvd.cvdTrend === "rising" && cvd.priceCvdDivergence !== "bearish") {
      const stop = atLvn.low - binSize;
      const risk = price - stop;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target > price && (target - price) / risk >= 1.5) {
        return {
          side: "long",
          entryPrice: price,
          entryAt: nowMs,
          stop,
          target,
          exitPrice: null,
          exitAt: null,
          r: null,
          entryContext,
          previousAction: null,
          pocSnapshots: [{ ms: nowMs, poc: structure.poc, price }],
          temporal,
          eventSequence,
        };
      }
    }
    if (cvd.cvdTrend === "falling" && cvd.priceCvdDivergence !== "bullish") {
      const stop = atLvn.high + binSize;
      const risk = stop - price;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target < price && (price - target) / risk >= 1.5) {
        return {
          side: "short",
          entryPrice: price,
          entryAt: nowMs,
          stop,
          target,
          exitPrice: null,
          exitAt: null,
          r: null,
          entryContext,
          previousAction: null,
          pocSnapshots: [{ ms: nowMs, poc: structure.poc, price }],
          temporal,
          eventSequence,
        };
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
        return {
          side: "short",
          entryPrice: price,
          entryAt: nowMs,
          stop,
          target,
          exitPrice: null,
          exitAt: null,
          r: null,
          entryContext,
          previousAction: null,
          pocSnapshots: [{ ms: nowMs, poc: structure.poc, price }],
          temporal,
          eventSequence,
        };
      }
    }

    if (isNearValueLow && cvd.priceCvdDivergence === "bullish") {
      const stop = atHvn.low - binSize;
      const risk = price - stop;
      if (risk < minRisk) return null;
      const target = structure.poc;
      if (target > price && (target - price) / risk >= 1.5) {
        return {
          side: "long",
          entryPrice: price,
          entryAt: nowMs,
          stop,
          target,
          exitPrice: null,
          exitAt: null,
          r: null,
          entryContext,
          previousAction: null,
          pocSnapshots: [{ ms: nowMs, poc: structure.poc, price }],
          temporal,
          eventSequence,
        };
      }
    }
  }

  return null;
}

function updateTrade(
  trade: Trade,
  currentPrice: number,
  nowMs: number,
  structure: VolumeProfileStructure,
  _cvd: CvdRead | null,
  noTrail: boolean,
): Trade {
  const risk = Math.abs(trade.entryPrice - trade.stop);

  if (trade.side === "long") {
    if (currentPrice <= trade.stop) {
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
    }
    if (currentPrice >= trade.target) {
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.target - trade.entryPrice) / risk };
    }
    if (!noTrail) {
      const trailTrigger = risk * 0.5;
      if (currentPrice >= trade.entryPrice + trailTrigger) {
        const newStop = Math.max(trade.stop, trade.entryPrice + risk * 0.25);
        if (trade.stop < newStop) {
          return { ...trade, stop: newStop };
        }
      }
    }
  } else {
    if (currentPrice >= trade.stop) {
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
    }
    if (currentPrice <= trade.target) {
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.entryPrice - trade.target) / risk };
    }
    if (!noTrail) {
      const trailTrigger = risk * 0.5;
      if (currentPrice <= trade.entryPrice - trailTrigger) {
        const newStop = Math.min(trade.stop, trade.entryPrice - risk * 0.25);
        if (trade.stop > newStop) {
          return { ...trade, stop: newStop };
        }
      }
    }
  }

  return trade;
}

function analyzeWinLoss(trades: Trade[]): WinLossAnalysis {
  const dimensions = [
    "action",
    "location",
    "absorption",
    "cvdTrend",
    "cvdDivergence",
    "nodeType",
  ] as const;

  const groups = new Map<string, Trade[]>();

  for (const t of trades) {
    const ctx = t.entryContext;
    const nodeType = ctx.isLvn ? "lvn" : ctx.isHvn ? "hvn" : "other";
    const cvdTrend = ctx.cvd?.cvdTrend ?? "unknown";
    const cvdDiv = ctx.cvd?.priceCvdDivergence ?? "unknown";

    const keys = [
      `action:${ctx.action}`,
      `location:${ctx.location}`,
      `absorption:${ctx.absorption}`,
      `cvdTrend:${cvdTrend}`,
      `cvdDivergence:${cvdDiv}`,
      `nodeType:${nodeType}`,
    ];

    for (const key of keys) {
      const existing = groups.get(key);
      if (existing) {
        existing.push(t);
      } else {
        groups.set(key, [t]);
      }
    }
  }

  const conditions: ConditionStats[] = [];
  for (const [condition, group] of groups) {
    const wins = group.filter((t) => t.r !== null && t.r > 0).length;
    const losses = group.filter((t) => t.r !== null && t.r < 0).length;
    const totalR = group.reduce((sum, t) => sum + (t.r ?? 0), 0);
    conditions.push({
      condition,
      total: group.length,
      wins,
      losses,
      winRate: group.length > 0 ? wins / group.length : 0,
      totalR,
      avgR: group.length > 0 ? totalR / group.length : 0,
    });
  }

  conditions.sort((a, b) => b.avgR - a.avgR);

  return { conditions };
}

function computeDirectionStats(trades: Trade[], side: "long" | "short"): DirectionStats {
  const filtered = trades.filter((t) => t.side === side);
  let wins = 0;
  let losses = 0;
  let totalR = 0;
  let peakR = 0;
  let maxDD = 0;

  for (const t of filtered) {
    const r = t.r ?? 0;
    if (r > 0) wins++;
    else if (r < 0) losses++;
    totalR += r;
    if (totalR > peakR) peakR = totalR;
    const dd = peakR - totalR;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    trades: filtered.length,
    wins,
    losses,
    winRate: filtered.length > 0 ? wins / filtered.length : 0,
    totalR,
    avgR: filtered.length > 0 ? totalR / filtered.length : 0,
    maxDD,
  };
}

function summarizeTrades(trades: Trade[]): BacktestResult {
  let wins = 0;
  let losses = 0;
  let totalR = 0;
  let peakR = 0;
  let maxDD = 0;

  for (const t of trades) {
    const r = t.r ?? 0;
    if (r > 0) wins++;
    else if (r < 0) losses++;
    totalR += r;
    if (totalR > peakR) peakR = totalR;
    const dd = peakR - totalR;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? wins / trades.length : 0,
    totalR,
    averageR: trades.length > 0 ? totalR / trades.length : 0,
    maxDrawdownR: maxDD,
    trades,
    winLossAnalysis: analyzeWinLoss(trades),
    long: computeDirectionStats(trades, "long"),
    short: computeDirectionStats(trades, "short"),
  };
}

function printResult(result: BacktestResult): void {
  console.log("\n=== BACKTEST RESULTS ===");
  console.log(`Total trades: ${result.totalTrades}`);
  console.log(`Wins: ${result.wins}, Losses: ${result.losses}`);
  console.log(`Win rate: ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`Total R: ${result.totalR.toFixed(2)}`);
  console.log(`Average R: ${result.averageR.toFixed(4)}`);
  console.log(`Max drawdown: ${result.maxDrawdownR.toFixed(2)}R`);

  const printDir = (label: string, d: DirectionStats) => {
    console.log(`\n  ${label}: ${d.trades} trades, ${(d.winRate * 100).toFixed(1)}% win, ${d.avgR.toFixed(4)} avg R, ${d.totalR.toFixed(1)} total R, ${d.maxDD.toFixed(1)}R DD`);
  };
  printDir("Long", result.long);
  printDir("Short", result.short);

  const analysis = result.winLossAnalysis;
  console.log("\n=== CONDITION EDGE ANALYSIS (P(win | condition)) ===");
  console.log("  Condition                    | Trades | Wins  | Losses | Win%  | Avg R  | Total R");
  console.log("  -----------------------------|--------|-------|--------|-------|--------|--------");
  for (const c of analysis.conditions) {
    const wr = (c.winRate * 100).toFixed(1);
    const avgR = c.avgR.toFixed(2);
    const totalR = c.totalR.toFixed(1);
    console.log(
      `  ${c.condition.padEnd(28)}| ${String(c.total).padStart(6)} | ${String(c.wins).padStart(5)} | ${String(c.losses).padStart(6)} | ${wr.padStart(5)} | ${avgR.padStart(6)} | ${totalR.padStart(7)}`,
    );
  }

  const target = 0.2;
  console.log(`\n=== COMPARISON ===`);
  console.log(`Baseline: 0.09 R/trade`);
  console.log(`Target: >${target} R/trade`);
  console.log(`Result: ${result.averageR.toFixed(4)} R/trade`);
  console.log(`Win rate: ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`Total R: ${result.totalR.toFixed(2)}`);
  console.log(`Max DD: ${result.maxDrawdownR.toFixed(2)}R`);
  console.log(result.averageR >= target ? "TARGET MET" : "TARGET NOT MET");
}

type StreakStats = {
  length: number;
  sampleCount: number;
  winRateOfNext: number;
  avgROfNext: number;
  totalROfNext: number;
  maxDDOfNext: number;
};

type StreakDistribution = {
  mean: number;
  median: number;
  mode: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
  range: number;
  histogram: Map<number, number>;
};

type HypothesisStreakReport = {
  hypothesis: string;
  winStreaks: StreakStats[];
  lossStreaks: StreakStats[];
  winStreakDist: StreakDistribution;
  lossStreakDist: StreakDistribution;
};

function computeDistribution(lengths: number[]): StreakDistribution {
  if (lengths.length === 0) {
    return { mean: 0, median: 0, mode: 0, variance: 0, stdDev: 0, min: 0, max: 0, range: 0, histogram: new Map() };
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  const mean = lengths.reduce((s, v) => s + v, 0) / lengths.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = lengths.reduce((s, v) => s + (v - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  const freq = new Map<number, number>();
  for (const l of lengths) freq.set(l, (freq.get(l) ?? 0) + 1);
  let mode = sorted[0];
  let maxFreq = 0;
  for (const [val, count] of freq) {
    if (count > maxFreq) { maxFreq = count; mode = val; }
  }

  return {
    mean, median, mode, variance, stdDev,
    min: sorted[0], max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    histogram: freq,
  };
}

function analyzeStreaks(trades: Trade[]): HypothesisStreakReport[] {
  const hypotheses = ["discovering", "rejecting", "accepting"] as const;
  const reports: HypothesisStreakReport[] = [];

  for (const hyp of hypotheses) {
    const hypTrades = trades.filter((t) => t.entryContext.action === hyp && t.r !== null);
    if (hypTrades.length < 2) continue;

    type Streak = { length: number; nextTrade: Trade | null };

    const winStreaks: Streak[] = [];
    const lossStreaks: Streak[] = [];

    let streakLen = 0;
    let streakIsWin: boolean | null = null;

    for (let i = 0; i < hypTrades.length; i++) {
      const t = hypTrades[i];
      const isWin = t.r! > 0;

      if (streakIsWin === null || isWin !== streakIsWin) {
        if (streakLen > 0 && streakIsWin !== null) {
          const streaks = streakIsWin ? winStreaks : lossStreaks;
          const nextIdx = i + 1;
          streaks.push({ length: streakLen, nextTrade: nextIdx < hypTrades.length ? hypTrades[nextIdx] : null });
        }
        streakLen = 1;
        streakIsWin = isWin;
      } else {
        streakLen++;
      }
    }
    if (streakLen > 0 && streakIsWin !== null) {
      const streaks = streakIsWin ? winStreaks : lossStreaks;
      streaks.push({ length: streakLen, nextTrade: null });
    }

    const buildStats = (streaks: Streak[]): StreakStats[] => {
      const byLength = new Map<number, Trade[]>();
      for (const s of streaks) {
        if (!s.nextTrade) continue;
        const existing = byLength.get(s.length);
        if (existing) existing.push(s.nextTrade);
        else byLength.set(s.length, [s.nextTrade]);
      }

      const stats: StreakStats[] = [];
      for (const [length, nextTrades] of byLength) {
        const wins = nextTrades.filter((t) => t.r! > 0).length;
        const totalR = nextTrades.reduce((s, t) => s + t.r!, 0);
        let peak = 0; let dd = 0; let maxDD = 0;
        for (const t of nextTrades) {
          peak += t.r!;
          if (peak > 0) peak = peak;
          const d = peak - totalR;
          if (d > maxDD) maxDD = d;
        }
        stats.push({
          length,
          sampleCount: nextTrades.length,
          winRateOfNext: wins / nextTrades.length,
          avgROfNext: totalR / nextTrades.length,
          totalROfNext: totalR,
          maxDDOfNext: maxDD,
        });
      }
      stats.sort((a, b) => a.length - b.length);
      return stats;
    };

    const winLengths = winStreaks.map((s) => s.length);
    const lossLengths = lossStreaks.map((s) => s.length);

    reports.push({
      hypothesis: hyp,
      winStreaks: buildStats(winStreaks),
      lossStreaks: buildStats(lossStreaks),
      winStreakDist: computeDistribution(winLengths),
      lossStreakDist: computeDistribution(lossLengths),
    });
  }

  return reports;
}

function printStreakAnalysis(reports: HypothesisStreakReport[]): void {
  for (const r of reports) {
    console.log(`\n=== STREAK ANALYSIS: ${r.hypothesis.toUpperCase()} ===`);

    const printDist = (label: string, d: StreakDistribution) => {
      console.log(`\n  ${label} Distribution:`);
      console.log(`    Mean: ${d.mean.toFixed(2)}, Median: ${d.median}, Mode: ${d.mode}`);
      console.log(`    StdDev: ${d.stdDev.toFixed(2)}, Variance: ${d.variance.toFixed(2)}`);
      console.log(`    Min: ${d.min}, Max: ${d.max}, Range: ${d.range}`);
      console.log(`    Histogram:`);
      const sorted = [...d.histogram.entries()].sort((a, b) => a[0] - b[0]);
      for (const [len, count] of sorted) {
        const bar = "#".repeat(Math.min(count, 50));
        console.log(`      streak ${String(len).padStart(2)}: ${String(count).padStart(4)} ${bar}`);
      }
    };

    printDist("Win Streaks", r.winStreakDist);
    printDist("Loss Streaks", r.lossStreakDist);

    const printStreakTable = (label: string, streaks: StreakStats[]) => {
      if (streaks.length === 0) { console.log(`\n  No ${label} data.`); return; }
      console.log(`\n  ${label} -> Next Trade Performance:`);
      console.log("  Streak | Samples | Next Win% | Next Avg R | Next Total R | Max DD");
      console.log("  -------|---------|-----------|------------|--------------|-------");
      for (const s of streaks) {
        console.log(
          `  ${String(s.length).padStart(6)} | ${String(s.sampleCount).padStart(7)} | ${(s.winRateOfNext * 100).toFixed(1).padStart(9)} | ${s.avgROfNext.toFixed(4).padStart(10)} | ${s.totalROfNext.toFixed(1).padStart(12)} | ${s.maxDDOfNext.toFixed(1).padStart(5)}`,
        );
      }
    };

    printStreakTable("Win Streaks", r.winStreaks);
    printStreakTable("Loss Streaks", r.lossStreaks);
  }
}

type CvdTransition = {
  trend: string;
  divergence: string;
  magnitude: string;
  priceDir: string;
};

type TransitionStats = {
  transition: string;
  count: number;
  nextWins: number;
  nextLosses: number;
  nextWinRate: number;
  nextAvgR: number;
  nextTotalR: number;
};

type StateEvolutionReport = {
  cvdTrendTransitions: TransitionStats[];
  cvdDivTransitions: TransitionStats[];
  cvdMagTransitions: TransitionStats[];
  priceDirTransitions: TransitionStats[];
};

function getCvdTransition(first: EntryContext, last: EntryContext): CvdTransition {
  return {
    trend: `${first.cvd?.cvdTrend ?? "?"}->${last.cvd?.cvdTrend ?? "?"}`,
    divergence: `${first.cvd?.priceCvdDivergence ?? "?"}->${last.cvd?.priceCvdDivergence ?? "?"}`,
    magnitude: `${getMag(first)}->${getMag(last)}`,
    priceDir: `${getPriceDir(first)}->${getPriceDir(last)}`,
  };
}

function getMag(ctx: EntryContext): string {
  if (!ctx.cvd) return "?";
  const range = ctx.cvd.cvdHigh - ctx.cvd.cvdLow;
  return range > 100 ? "high" : range > 30 ? "med" : "low";
}

function getPriceDir(ctx: EntryContext): string {
  if (!ctx.cvd) return "?";
  return ctx.cvd.priceChange > 50 ? "up" : ctx.cvd.priceChange < -50 ? "down" : "flat";
}

function analyzeStateEvolution(trades: Trade[]): StateEvolutionReport {
  const hypotheses = ["discovering", "rejecting", "accepting"] as const;
  const trendMap = new Map<string, { wins: number; losses: number; totalR: number }>();
  const divMap = new Map<string, { wins: number; losses: number; totalR: number }>();
  const magMap = new Map<string, { wins: number; losses: number; totalR: number }>();
  const priceMap = new Map<string, { wins: number; losses: number; totalR: number }>();

  const ensure = (map: Map<string, { wins: number; losses: number; totalR: number }>, key: string) => {
    if (!map.has(key)) map.set(key, { wins: 0, losses: 0, totalR: 0 });
    return map.get(key)!;
  };

  for (const hyp of hypotheses) {
    const hypTrades = trades.filter((t) => t.entryContext.action === hyp && t.r !== null);
    if (hypTrades.length < 3) continue;

    let seqStart = 0;
    for (let i = 1; i <= hypTrades.length; i++) {
      const isEnd = i === hypTrades.length || hypTrades[i].r! > 0;
      if (isEnd) {
        const seqLen = i - seqStart;
        if (seqLen >= 2 && i + 1 < hypTrades.length) {
          const first = hypTrades[seqStart];
          const last = hypTrades[i - 1];
          const next = hypTrades[i + 1];
          const trans = getCvdTransition(first.entryContext, last.entryContext);
          const isWin = next.r! > 0;

          const update = (map: Map<string, { wins: number; losses: number; totalR: number }>, key: string) => {
            const s = ensure(map, key);
            if (isWin) s.wins++; else s.losses++;
            s.totalR += next.r!;
          };

          update(trendMap, trans.trend);
          update(divMap, trans.divergence);
          update(magMap, trans.magnitude);
          update(priceMap, trans.priceDir);
        }
        seqStart = i;
      }
    }
  }

  const build = (map: Map<string, { wins: number; losses: number; totalR: number }>): TransitionStats[] => {
    const stats: TransitionStats[] = [];
    for (const [transition, s] of map) {
      const total = s.wins + s.losses;
      stats.push({
        transition,
        count: total,
        nextWins: s.wins,
        nextLosses: s.losses,
        nextWinRate: total > 0 ? s.wins / total : 0,
        nextAvgR: total > 0 ? s.totalR / total : 0,
        nextTotalR: s.totalR,
      });
    }
    stats.sort((a, b) => b.nextAvgR - a.nextAvgR);
    return stats;
  };

  return {
    cvdTrendTransitions: build(trendMap),
    cvdDivTransitions: build(divMap),
    cvdMagTransitions: build(magMap),
    priceDirTransitions: build(priceMap),
  };
}

function printTransitionTable(label: string, stats: TransitionStats[]): void {
  console.log(`\n  ${label}:`);
  console.log("  Transition         | Count | Next Win% | Next Avg R | Total R");
  console.log("  -------------------|-------|-----------|------------|--------");
  for (const s of stats) {
    if (s.count < 3) continue;
    console.log(
      `  ${s.transition.padEnd(18)}| ${String(s.count).padStart(5)} | ${(s.nextWinRate * 100).toFixed(1).padStart(9)} | ${s.nextAvgR.toFixed(4).padStart(10)} | ${s.nextTotalR.toFixed(1).padStart(6)}`,
    );
  }
}

function printStateAnalysis(report: StateEvolutionReport): void {
  console.log("\n=== CVD TRANSITION ANALYSIS ===");
  console.log("Expectancy of next trade after losing sequence, grouped by CVD transition type.");
  printTransitionTable("cvdTrend Transitions", report.cvdTrendTransitions);
  printTransitionTable("cvdDivergence Transitions", report.cvdDivTransitions);
  printTransitionTable("cvdMagnitude Transitions", report.cvdMagTransitions);
  printTransitionTable("Price Direction Transitions", report.priceDirTransitions);
}

type TransitionContext = "in-loss-streak" | "in-win-streak" | "at-boundary";

type AllTransitionStats = {
  transition: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  totalR: number;
  byContext: {
    "in-loss-streak": { count: number; wins: number; totalR: number; avgR: number };
    "in-win-streak": { count: number; wins: number; totalR: number; avgR: number };
    "at-boundary": { count: number; wins: number; totalR: number; avgR: number };
  };
};

type AllTransitionReport = {
  cvdTrendTransitions: AllTransitionStats[];
  cvdDivTransitions: AllTransitionStats[];
  cvdMagTransitions: AllTransitionStats[];
  priceDirTransitions: AllTransitionStats[];
};

function classifyContext(
  trades: { r: number | null }[],
  index: number,
): TransitionContext {
  const currentR = trades[index].r;
  const prevR = index > 0 ? trades[index - 1].r : null;

  const currentIsLoss = currentR !== null && currentR <= 0;
  const currentIsWin = currentR !== null && currentR > 0;

  if (currentIsLoss) return "in-loss-streak";
  if (currentIsWin) {
    if (prevR !== null && prevR <= 0) return "at-boundary";
    return "in-win-streak";
  }
  return "in-win-streak";
}

function analyzeAllTransitions(trades: Trade[]): AllTransitionReport {
  const hypotheses = ["discovering", "rejecting", "accepting"] as const;
  const trendMap = new Map<string, AllTransitionStats>();
  const divMap = new Map<string, AllTransitionStats>();
  const magMap = new Map<string, AllTransitionStats>();
  const priceMap = new Map<string, AllTransitionStats>();

  const ensure = (map: Map<string, AllTransitionStats>, key: string): AllTransitionStats => {
    if (!map.has(key)) {
      map.set(key, {
        transition: key,
        count: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgR: 0,
        totalR: 0,
        byContext: {
          "in-loss-streak": { count: 0, wins: 0, totalR: 0, avgR: 0 },
          "in-win-streak": { count: 0, wins: 0, totalR: 0, avgR: 0 },
          "at-boundary": { count: 0, wins: 0, totalR: 0, avgR: 0 },
        },
      });
    }
    return map.get(key)!;
  };

  for (const hyp of hypotheses) {
    const hypTrades = trades.filter((t) => t.entryContext.action === hyp && t.r !== null);
    if (hypTrades.length < 2) continue;

    for (let i = 1; i < hypTrades.length; i++) {
      const prev = hypTrades[i - 1];
      const curr = hypTrades[i];
      const trans = getCvdTransition(prev.entryContext, curr.entryContext);
      const ctx = classifyContext(hypTrades, i);
      const isWin = curr.r! > 0;

      const update = (map: Map<string, AllTransitionStats>, key: string) => {
        const s = ensure(map, key);
        s.count++;
        if (isWin) s.wins++; else s.losses++;
        s.totalR += curr.r!;
        const c = s.byContext[ctx];
        c.count++;
        if (isWin) c.wins++;
        c.totalR += curr.r!;
      };

      update(trendMap, trans.trend);
      update(divMap, trans.divergence);
      update(magMap, trans.magnitude);
      update(priceMap, trans.priceDir);
    }
  }

  const build = (map: Map<string, AllTransitionStats>): AllTransitionStats[] => {
    const stats: AllTransitionStats[] = [];
    for (const [, s] of map) {
      s.winRate = s.count > 0 ? s.wins / s.count : 0;
      s.avgR = s.count > 0 ? s.totalR / s.count : 0;
      for (const ctx of ["in-loss-streak", "in-win-streak", "at-boundary"] as const) {
        const c = s.byContext[ctx];
        c.avgR = c.count > 0 ? c.totalR / c.count : 0;
      }
      stats.push(s);
    }
    stats.sort((a, b) => b.avgR - a.avgR);
    return stats;
  };

  return {
    cvdTrendTransitions: build(trendMap),
    cvdDivTransitions: build(divMap),
    cvdMagTransitions: build(magMap),
    priceDirTransitions: build(priceMap),
  };
}

function printAllTransitionTable(label: string, stats: AllTransitionStats[]): void {
  console.log(`\n  ${label}:`);
  console.log("  Transition         | Count | Win%  | Avg R  | Total R | loss-streak(R) | win-streak(R) | boundary(R)");
  console.log("  -------------------|-------|-------|--------|---------|----------------|---------------|------------");
  for (const s of stats) {
    if (s.count < 3) continue;
    const lossCtx = s.byContext["in-loss-streak"];
    const winCtx = s.byContext["in-win-streak"];
    const boundCtx = s.byContext["at-boundary"];
    const fmtCtx = (c: { count: number; avgR: number }) =>
      c.count > 0 ? `${c.avgR.toFixed(2)} (${c.count})` : "-";
    console.log(
      `  ${s.transition.padEnd(18)}| ${String(s.count).padStart(5)} | ${(s.winRate * 100).toFixed(0).padStart(5)} | ${s.avgR.toFixed(2).padStart(6)} | ${s.totalR.toFixed(1).padStart(7)} | ${fmtCtx(lossCtx).padStart(14)} | ${fmtCtx(winCtx).padStart(13)} | ${fmtCtx(boundCtx).padStart(10)}`,
    );
  }
}

function printAllTransitionAnalysis(report: AllTransitionReport): void {
  console.log("\n=== ALL CVD TRANSITIONS ===");
  console.log("Expectancy of each trade grouped by CVD transition from previous trade. Context columns show avg R within loss-streak, win-streak, or at boundary (loss->win).");
  printAllTransitionTable("cvdTrend Transitions", report.cvdTrendTransitions);
  printAllTransitionTable("cvdDivergence Transitions", report.cvdDivTransitions);
  printAllTransitionTable("cvdMagnitude Transitions", report.cvdMagTransitions);
  printAllTransitionTable("Price Direction Transitions", report.priceDirTransitions);
}

type NumericFeatureResult = {
  feature: string;
  type: "numeric";
  bigN: number;
  restN: number;
  bigMean: number;
  restMean: number;
  bigMedian: number;
  restMedian: number;
  effectSize: number;
  ranking: number;
};

type CategoricalFeatureResult = {
  feature: string;
  type: "categorical";
  bigN: number;
  restN: number;
  categories: string[];
  bigDist: Record<string, number>;
  restDist: Record<string, number>;
  jsDivergence: number;
  ranking: number;
};

type FeatureAnalysisReport = {
  bigThreshold: number;
  bigCount: number;
  restCount: number;
  totalCount: number;
  features: (NumericFeatureResult | CategoricalFeatureResult)[];
};

function extractNumericFeatures(trade: Trade): number[] {
  const e = trade.entryContext;
  const cvd = e.cvd;
  const nodeVol = e.nearestNode?.volume ?? 0;
  const profileRange = e.profileRange || 1;
  return [
    trade.side === "long" ? 1 : 0,
    e.absorption ? 1 : 0,
    nodeVol,
    e.nearestNode?.low ?? 0,
    e.nearestNode?.high ?? 0,
    e.nearestNode?.mid ?? 0,
    cvd?.cvd ?? 0,
    cvd?.cvdHigh ?? 0,
    cvd?.cvdLow ?? 0,
    cvd?.priceChange ?? 0,
    e.binSize,
    e.priceDistanceToPoc,
    e.priceDistanceToValueHigh,
    e.priceDistanceToValueLow,
    profileRange,
    e.isLvn ? 1 : 0,
    e.isHvn ? 1 : 0,
    trade.entryPrice,
    trade.stop,
    trade.target,
    (trade.target - trade.entryPrice) / (trade.entryPrice - trade.stop || 1),
    e.priceDistanceToPoc / (profileRange || 1),
    e.priceDistanceToValueHigh / (profileRange || 1),
    e.priceDistanceToValueLow / (profileRange || 1),
    cvd ? (cvd.cvdHigh - cvd.cvdLow) : 0,
    cvd ? Math.abs(cvd.priceChange) / (cvd.cvdHigh - cvd.cvdLow || 1) : 0,
    cvd ? cvd.cvd / (cvd.cvdHigh - cvd.cvdLow || 1) : 0,
    trade.temporal.cvdSlope,
    trade.temporal.cvdAcceleration,
    trade.temporal.priceVelocity,
    trade.temporal.priceAcceleration,
    trade.temporal.buySellRatio,
    trade.temporal.volumeSlope,
    trade.temporal.tradeRate,
    trade.temporal.deltaPersistence,
    trade.temporal.upCloseRatio,
    trade.temporal.cvdSignChanges,
    trade.temporal.cvdLongestRun,
    trade.temporal.cvdImpulseCount,
    trade.temporal.cvdAvgImpulse,
    trade.temporal.priceRetracement,
  ];
}

const NUMERIC_LABELS = [
  "side(long=1)",
  "absorption",
  "nodeVolume",
  "nodeLow",
  "nodeHigh",
  "nodeMid",
  "cvd",
  "cvdHigh",
  "cvdLow",
  "priceChange",
  "binSize",
  "distToPoc",
  "distToValueHigh",
  "distToValueLow",
  "profileRange",
  "isLvn",
  "isHvn",
  "entryPrice",
  "stop",
  "target",
  "rewardRiskRatio",
  "distToPoc_pct",
  "distToValueHigh_pct",
  "distToValueLow_pct",
  "cvdRange",
  "priceChangePerCvdRange",
  "cvdNormalized",
  "cvdSlope",
  "cvdAcceleration",
  "priceVelocity",
  "priceAcceleration",
  "buySellRatio",
  "volumeSlope",
  "tradeRate",
  "deltaPersistence",
  "upCloseRatio",
  "cvdSignChanges",
  "cvdLongestRun",
  "cvdImpulseCount",
  "cvdAvgImpulse",
  "priceRetracement",
];

function extractCategoricalFeatures(trade: Trade): string[] {
  const e = trade.entryContext;
  const cvd = e.cvd;
  return [
    e.action,
    e.location,
    e.nearestNode?.kind ?? "none",
    cvd?.cvdTrend ?? "unknown",
    cvd?.priceCvdDivergence ?? "unknown",
  ];
}

const CATEGORICAL_LABELS = ["action", "location", "nodeKind", "cvdTrend", "cvdDivergence"];

function cohenD(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const meanA = a.reduce((s, x) => s + x, 0) / a.length;
  const meanB = b.reduce((s, x) => s + x, 0) / b.length;
  const varA = a.reduce((s, x) => s + (x - meanA) ** 2, 0) / (a.length - 1);
  const varB = b.reduce((s, x) => s + (x - meanB) ** 2, 0) / (b.length - 1);
  const pooledStd = Math.sqrt(((a.length - 1) * varA + (b.length - 1) * varB) / (a.length + b.length - 2));
  if (pooledStd === 0) return 0;
  return Math.abs(meanA - meanB) / pooledStd;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function jsDivergence(p: Record<string, number>, q: Record<string, number>): number {
  const allKeys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let klPM = 0;
  let klQM = 0;
  const eps = 1e-10;
  for (const k of allKeys) {
    const pi = (p[k] ?? 0) + eps;
    const qi = (q[k] ?? 0) + eps;
    const mi = (pi + qi) / 2;
    klPM += pi * Math.log(pi / mi);
    klQM += qi * Math.log(qi / mi);
  }
  return (klPM + klQM) / 2;
}

function analyzeFeatureDiscrimination(trades: Trade[], threshold: number): FeatureAnalysisReport {
  const completed = trades.filter((t) => t.r !== null);
  const big = completed.filter((t) => t.r! >= threshold);
  const rest = completed.filter((t) => t.r! < threshold);

  const numericResults: NumericFeatureResult[] = [];
  for (let fi = 0; fi < NUMERIC_LABELS.length; fi++) {
    const bigVals = big.map((t) => extractNumericFeatures(t)[fi]);
    const restVals = rest.map((t) => extractNumericFeatures(t)[fi]);
    const d = cohenD(bigVals, restVals);
    numericResults.push({
      feature: NUMERIC_LABELS[fi],
      type: "numeric",
      bigN: big.length,
      restN: rest.length,
      bigMean: bigVals.reduce((s, x) => s + x, 0) / bigVals.length,
      restMean: restVals.reduce((s, x) => s + x, 0) / restVals.length,
      bigMedian: median(bigVals),
      restMedian: median(restVals),
      effectSize: d,
      ranking: d,
    });
  }

  const categoricalResults: CategoricalFeatureResult[] = [];
  for (let fi = 0; fi < CATEGORICAL_LABELS.length; fi++) {
    const bigCats = big.map((t) => extractCategoricalFeatures(t)[fi]);
    const restCats = rest.map((t) => extractCategoricalFeatures(t)[fi]);
    const allCats = new Set([...bigCats, ...restCats]);
    const bigDist: Record<string, number> = {};
    const restDist: Record<string, number> = {};
    for (const c of allCats) {
      bigDist[c] = bigCats.filter((x) => x === c).length / bigCats.length;
      restDist[c] = restCats.filter((x) => x === c).length / restCats.length;
    }
    const jsd = jsDivergence(bigDist, restDist);
    categoricalResults.push({
      feature: CATEGORICAL_LABELS[fi],
      type: "categorical",
      bigN: big.length,
      restN: rest.length,
      categories: [...allCats],
      bigDist,
      restDist,
      jsDivergence: jsd,
      ranking: jsd,
    });
  }

  const all: (NumericFeatureResult | CategoricalFeatureResult)[] = [...numericResults, ...categoricalResults];
  all.sort((a, b) => b.ranking - a.ranking);

  return {
    bigThreshold: threshold,
    bigCount: big.length,
    restCount: rest.length,
    totalCount: completed.length,
    features: all,
  };
}

function printFeatureAnalysis(report: FeatureAnalysisReport): void {
  console.log("\n=== FEATURE DISCRIMINATION ANALYSIS ===");
  console.log(`Large winners: R >= ${report.bigThreshold} (${report.bigCount} trades)`);
  console.log(`Everything else: R < ${report.bigThreshold} (${report.restCount} trades)`);
  console.log(`Total completed trades: ${report.totalCount}`);
  console.log(`\nRanked by discriminative power (Cohen's d for numeric, JS divergence for categorical).\n`);

  console.log("NUMERIC FEATURES (ranked by |Cohen's d|):");
  console.log("  Feature             | Big Mean  | Rest Mean| Big Med  | Rest Med | |d|    ");
  console.log("  --------------------|-----------|----------|----------|----------|--------");
  for (const f of report.features.filter((f) => f.type === "numeric") as NumericFeatureResult[]) {
    if (f.effectSize < 0.05) continue;
    console.log(
      `  ${f.feature.padEnd(20)}| ${f.bigMean.toFixed(2).padStart(9)} | ${f.restMean.toFixed(2).padStart(8)} | ${f.bigMedian.toFixed(2).padStart(8)} | ${f.restMedian.toFixed(2).padStart(8)} | ${f.effectSize.toFixed(4).padStart(6)}`,
    );
  }

  console.log("\nCATEGORICAL FEATURES (ranked by JS divergence):");
  console.log("  Feature          | JSD    | Big top category (freq)     | Rest top category (freq)    ");
  console.log("  -----------------|--------|-----------------------------|-----------------------------");
  for (const f of report.features.filter((f) => f.type === "categorical") as CategoricalFeatureResult[]) {
    if (f.jsDivergence < 0.001) continue;
    const bigTop = Object.entries(f.bigDist).sort((a, b) => b[1] - a[1])[0];
    const restTop = Object.entries(f.restDist).sort((a, b) => b[1] - a[1])[0];
    console.log(
      `  ${f.feature.padEnd(16)}| ${f.jsDivergence.toFixed(4).padStart(6)} | ${(bigTop[0] + " " + (bigTop[1] * 100).toFixed(0) + "%").padEnd(27)} | ${(restTop[0] + " " + (restTop[1] * 100).toFixed(0) + "%").padEnd(27)}`,
    );
    const bigRunner = Object.entries(f.bigDist)
      .sort((a, b) => b[1] - a[1])
      .slice(1, 3);
    const restRunner = Object.entries(f.restDist)
      .sort((a, b) => b[1] - a[1])
      .slice(1, 3);
    if (bigRunner.length > 0 || restRunner.length > 0) {
      const bigStr = bigRunner.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(", ");
      const restStr = restRunner.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(", ");
      console.log(`  ${"".padEnd(16)}|        | ${bigStr.padEnd(27)} | ${restStr.padEnd(27)}`);
    }
  }

  console.log("\nTOP 5 MOST DISCRIMINATIVE FEATURES:");
  const top5 = report.features.slice(0, 5);
  for (let i = 0; i < top5.length; i++) {
    const f = top5[i];
    if (f.type === "numeric") {
      const nf = f as NumericFeatureResult;
      console.log(
        `  ${i + 1}. ${nf.feature} (|d|=${nf.effectSize.toFixed(3)}) big=${nf.bigMean.toFixed(2)} rest=${nf.restMean.toFixed(2)}`,
      );
    } else {
      const cf = f as CategoricalFeatureResult;
      const bigTop = Object.entries(cf.bigDist).sort((a, b) => b[1] - a[1])[0];
      const restTop = Object.entries(cf.restDist).sort((a, b) => b[1] - a[1])[0];
      console.log(
        `  ${i + 1}. ${cf.feature} (JSD=${cf.jsDivergence.toFixed(3)}) big=${bigTop[0]}(${(bigTop[1] * 100).toFixed(0)}%) rest=${restTop[0]}(${(restTop[1] * 100).toFixed(0)}%)`,
      );
    }
  }
}

type ResponseBin = {
  binIndex: number;
  binLabel: string;
  count: number;
  wins: number;
  winRate: number;
  avgR: number;
  medianR: number;
  totalR: number;
  avgRWithoutOutliers: number;
};

type ResponseCurveResult = {
  feature: string;
  bins: ResponseBin[];
  monotonicityScore: number;
  spearmanRho: number;
};

const RESPONSE_FEATURES: { extract: (t: Trade) => number; label: string }[] = [
  { extract: (t) => t.entryContext.priceDistanceToPoc, label: "distToPoc" },
  { extract: (t) => t.entryContext.profileRange, label: "profileRange" },
  { extract: (t) => t.entryContext.nearestNode?.volume ?? 0, label: "nodeVolume" },
  { extract: (t) => t.entryContext.priceDistanceToValueLow, label: "distToValueLow" },
];

function equalFrequencyBins(values: number[], nBins: number): { thresholds: number[]; edges: [number, number][] } {
  const sorted = [...values].sort((a, b) => a - b);
  const binSize = Math.ceil(sorted.length / nBins);
  const thresholds: number[] = [];
  const edges: [number, number][] = [];
  for (let i = 0; i < nBins; i++) {
    const start = i * binSize;
    const end = Math.min((i + 1) * binSize, sorted.length);
    if (start >= sorted.length) break;
    edges.push([sorted[start], sorted[end - 1]]);
    if (i > 0) thresholds.push(sorted[start]);
  }
  return { thresholds, edges };
}

function spearmanRho(x: number[], y: number[]): number {
  const rank = (arr: number[]): number[] => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let r = 0; r < indexed.length; r++) ranks[indexed[r].i] = r + 1;
    return ranks;
  };
  const rx = rank(x);
  const ry = rank(y);
  const n = rx.length;
  let sumD2 = 0;
  for (let i = 0; i < n; i++) sumD2 += (rx[i] - ry[i]) ** 2;
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function monotonicityScore(values: number[]): number {
  if (values.length < 2) return 0;
  let ups = 0;
  let downs = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) ups++;
    else if (values[i] < values[i - 1]) downs++;
  }
  return (ups - downs) / (values.length - 1);
}

function analyzeResponseCurves(trades: Trade[]): ResponseCurveResult[] {
  const completed = trades.filter((t) => t.r !== null);
  const nBins = 10;
  const results: ResponseCurveResult[] = [];

  for (const feat of RESPONSE_FEATURES) {
    const values = completed.map((t) => feat.extract(t));
    const { thresholds, edges } = equalFrequencyBins(values, nBins);
    const bins: ResponseBin[] = [];

    for (let bi = 0; bi < edges.length; bi++) {
      const lo = edges[bi][0];
      const hi = edges[bi][1];
      const inBin = completed.filter((t) => {
        const v = feat.extract(t);
        if (bi === 0) return v <= hi;
        if (bi === edges.length - 1) return v >= lo;
        return v >= lo && v <= hi;
      });
      const wins = inBin.filter((t) => t.r! > 0);
      const rVals = inBin.map((t) => t.r!);
      const sortedR = [...rVals].sort((a, b) => a - b);
      const trimStart = Math.floor(sortedR.length * 0.1);
      const trimEnd = Math.ceil(sortedR.length * 0.9);
      const trimmed = sortedR.slice(trimStart, trimEnd);

      bins.push({
        binIndex: bi,
        binLabel: bi === 0
          ? `< ${edges[0][1].toFixed(0)}`
          : bi === edges.length - 1
            ? `>= ${edges[bi][0].toFixed(0)}`
            : `${edges[bi][0].toFixed(0)}-${edges[bi][1].toFixed(0)}`,
        count: inBin.length,
        wins: wins.length,
        winRate: inBin.length > 0 ? wins.length / inBin.length : 0,
        avgR: inBin.length > 0 ? rVals.reduce((s, x) => s + x, 0) / inBin.length : 0,
        medianR: rVals.length > 0 ? median(rVals) : 0,
        totalR: rVals.reduce((s, x) => s + x, 0),
        avgRWithoutOutliers: trimmed.length > 0 ? trimmed.reduce((s, x) => s + x, 0) / trimmed.length : 0,
      });
    }

    const avgRs = bins.map((b) => b.avgR);
    results.push({
      feature: feat.label,
      bins,
      monotonicityScore: monotonicityScore(avgRs),
      spearmanRho: spearmanRho(avgRs, bins.map((_, i) => i)),
    });
  }

  return results;
}

function printResponseCurves(results: ResponseCurveResult[]): void {
  console.log("\n=== RESPONSE CURVES ===");
  console.log("Equal-frequency decile bins. Each bin has ~10% of trades.");
  console.log("Monotonicity: +1 = perfectly increasing, -1 = perfectly decreasing.");
  console.log("Spearman rho: correlation between bin rank and avg R.\n");

  for (const r of results) {
    const mono = r.monotonicityScore;
    const rho = r.spearmanRho;
    const monoLabel = mono > 0.6 ? "STRONG +" : mono > 0.3 ? "mod +" : mono < -0.6 ? "STRONG -" : mono < -0.3 ? "mod -" : "weak";
    console.log(`  ${r.feature}  monotonicity=${mono.toFixed(2)} (${monoLabel})  spearman=${rho.toFixed(3)}`);
    console.log("  Bin              | Count | Win%  | Avg R  | Med R  | Trimmed R | Total R");
    console.log("  -----------------|-------|-------|--------|--------|-----------|--------");
    for (const b of r.bins) {
      const bar = "█".repeat(Math.max(0, Math.round((b.avgR + 5) / 2)));
      console.log(
        `  ${b.binLabel.padEnd(17)}| ${String(b.count).padStart(5)} | ${(b.winRate * 100).toFixed(0).padStart(5)} | ${b.avgR.toFixed(1).padStart(6)} | ${b.medianR.toFixed(1).padStart(6)} | ${b.avgRWithoutOutliers.toFixed(1).padStart(9)} | ${b.totalR.toFixed(0).padStart(6)}  ${bar}`,
      );
    }
    console.log();
  }
}

function analyzeAndExplainPoc(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null);
  console.log("\n=== WHY DOES distToPoc WORK? ===\n");

  // --- 1. Correlation Matrix ---
  console.log("1. CORRELATION MATRIX (Pearson r between distToPoc and other features)");
  console.log("   If r > 0.5, distToPoc may be a proxy for that feature.\n");

  const feats: { label: string; extract: (t: Trade) => number }[] = [
    { label: "profileRange", extract: (t) => t.entryContext.profileRange },
    { label: "nodeVolume", extract: (t) => t.entryContext.nearestNode?.volume ?? 0 },
    { label: "priceChange", extract: (t) => t.entryContext.cvd?.priceChange ?? 0 },
    { label: "cvdHigh", extract: (t) => t.entryContext.cvd?.cvdHigh ?? 0 },
    { label: "cvdLow", extract: (t) => t.entryContext.cvd?.cvdLow ?? 0 },
    { label: "distToValueHigh", extract: (t) => t.entryContext.priceDistanceToValueHigh },
    { label: "distToValueLow", extract: (t) => t.entryContext.priceDistanceToValueLow },
    { label: "entryPrice", extract: (t) => t.entryPrice },
  ];

  const pocVals = completed.map((t) => t.entryContext.priceDistanceToPoc);
  const pocMean = pocVals.reduce((s, x) => s + x, 0) / pocVals.length;

  for (const f of feats) {
    const fVals = completed.map((t) => f.extract(t));
    const fMean = fVals.reduce((s, x) => s + x, 0) / fVals.length;
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = 0; i < completed.length; i++) {
      const dx = pocVals[i] - pocMean;
      const dy = fVals[i] - fMean;
      num += dx * dy;
      denA += dx * dx;
      denB += dy * dy;
    }
    const r = denA > 0 && denB > 0 ? num / Math.sqrt(denA * denB) : 0;
    const proxy = Math.abs(r) > 0.5 ? " <-- PROXY RISK" : "";
    console.log(`   distToPoc vs ${f.label.padEnd(18)} r = ${r.toFixed(3).padStart(6)}${proxy}`);
  }

  // --- 2. Partial effect: distToPoc within profileRange deciles ---
  console.log("\n2. PARTIAL EFFECT: Does distToPoc predict R WITHIN each profileRange decile?");
  console.log("   If yes, distToPoc is NOT just a proxy for profileRange.\n");

  const withRanges = completed.map((t) => ({
    trade: t,
    poc: t.entryContext.priceDistanceToPoc,
    pr: t.entryContext.profileRange,
    r: t.r!,
  }));
  withRanges.sort((a, b) => a.pr - b.pr);
  const decileSize = Math.ceil(withRanges.length / 10);
  for (let d = 0; d < 10; d++) {
    const slice = withRanges.slice(d * decileSize, Math.min((d + 1) * decileSize, withRanges.length));
    if (slice.length < 4) continue;
    const medPoc = median(slice.map((s) => s.poc));
    const loHalf = slice.filter((s) => s.poc <= medPoc);
    const hiHalf = slice.filter((s) => s.poc > medPoc);
    const loR = loHalf.length > 0 ? loHalf.reduce((s, x) => s + x.r, 0) / loHalf.length : 0;
    const hiR = hiHalf.length > 0 ? hiHalf.reduce((s, x) => s + x.r, 0) / hiHalf.length : 0;
    const diff = hiR - loR;
    const arrow = diff > 2 ? "+++" : diff > 0 ? "+" : diff < -2 ? "---" : diff < 0 ? "-" : "=";
    console.log(
      `   PR decile ${String(d + 1).padStart(2)} (n=${String(slice.length).padStart(3)}, PR=${slice[0].pr.toFixed(0)}-${slice[slice.length - 1].pr.toFixed(0)}): low distToPoc avg R=${loR.toFixed(1).padStart(6)} | high distToPoc avg R=${hiR.toFixed(1).padStart(6)} | diff=${diff.toFixed(1).padStart(6)} ${arrow}`,
    );
  }

  // --- 3. Direction analysis: does price move further or return? ---
  console.log("\n3. DIRECTION ANALYSIS: After entry, does price continue away from POC or return?");
  console.log("   R measures move relative to stop. High distToPoc + high R = price kept going.\n");

  const pocDeciles: { label: string; trades: Trade[] }[] = [];
  const sortedByPoc = [...completed].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
  const dSize = Math.ceil(sortedByPoc.length / 5);
  for (let d = 0; d < 5; d++) {
    const slice = sortedByPoc.slice(d * dSize, Math.min((d + 1) * dSize, sortedByPoc.length));
    pocDeciles.push({
      label: d === 0 ? "Bottom 20%" : d === 4 ? "Top 20%" : `${(d * 20 + 1)}-${(d + 1) * 20}%`,
      trades: slice,
    });
  }

  console.log("   Group        | n  | Win%  | Avg R  | Avg |R|  | Avg entry dist | R>10 count");
  console.log("   -------------|----|-------|--------|---------|----------------|------------");
  for (const g of pocDeciles) {
    const wins = g.trades.filter((t) => t.r! > 0);
    const avgR = g.trades.reduce((s, t) => s + t.r!, 0) / g.trades.length;
    const avgAbsR = g.trades.reduce((s, t) => s + Math.abs(t.r!), 0) / g.trades.length;
    const avgDist = g.trades.reduce((s, t) => s + t.entryContext.priceDistanceToPoc, 0) / g.trades.length;
    const bigWins = g.trades.filter((t) => t.r! > 10).length;
    console.log(
      `   ${g.label.padEnd(13)}| ${String(g.trades.length).padStart(2)} | ${(wins.length / g.trades.length * 100).toFixed(0).padStart(5)} | ${avgR.toFixed(1).padStart(6)} | ${avgAbsR.toFixed(1).padStart(7)} | ${avgDist.toFixed(0).padStart(14)} | ${String(bigWins).padStart(10)}`,
    );
  }

  // --- 4. Cross-tabulation: distToPoc x cvdTrend ---
  console.log("\n4. CROSS-TAB: distToPoc x cvdTrend (does the effect hold within each trend?)\n");

  const trendGroups = ["rising", "falling", "flat"] as const;
  for (const trend of trendGroups) {
    const subset = completed.filter((t) => t.entryContext.cvd?.cvdTrend === trend);
    if (subset.length < 10) continue;
    const sorted = [...subset].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const half = Math.floor(sorted.length / 2);
    const loHalf = sorted.slice(0, half);
    const hiHalf = sorted.slice(half);
    const loR = loHalf.reduce((s, t) => s + t.r!, 0) / loHalf.length;
    const hiR = hiHalf.reduce((s, t) => s + t.r!, 0) / hiHalf.length;
    const loWin = loHalf.filter((t) => t.r! > 0).length / loHalf.length;
    const hiWin = hiHalf.filter((t) => t.r! > 0).length / hiHalf.length;
    console.log(
      `   cvdTrend=${trend.padEnd(7)} low distToPoc: n=${String(loHalf.length).padStart(3)} avg R=${loR.toFixed(1).padStart(6)} win=${(loWin * 100).toFixed(0).padStart(4)}% | high distToPoc: n=${String(hiHalf.length).padStart(3)} avg R=${hiR.toFixed(1).padStart(6)} win=${(hiWin * 100).toFixed(0).padStart(4)}%`,
    );
  }

  // --- 5. Cross-tab: distToPoc x action ---
  console.log("\n5. CROSS-TAB: distToPoc x action (does the effect hold within each action?)\n");

  const actionGroups = ["discovering", "rejecting", "accepting"] as const;
  for (const action of actionGroups) {
    const subset = completed.filter((t) => t.entryContext.action === action);
    if (subset.length < 10) continue;
    const sorted = [...subset].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const half = Math.floor(sorted.length / 2);
    const loHalf = sorted.slice(0, half);
    const hiHalf = sorted.slice(half);
    const loR = loHalf.reduce((s, t) => s + t.r!, 0) / loHalf.length;
    const hiR = hiHalf.reduce((s, t) => s + t.r!, 0) / hiHalf.length;
    const loWin = loHalf.filter((t) => t.r! > 0).length / loHalf.length;
    const hiWin = hiHalf.filter((t) => t.r! > 0).length / hiHalf.length;
    console.log(
      `   action=${action.padEnd(12)} low distToPoc: n=${String(loHalf.length).padStart(3)} avg R=${loR.toFixed(1).padStart(6)} win=${(loWin * 100).toFixed(0).padStart(4)}% | high distToPoc: n=${String(hiHalf.length).padStart(3)} avg R=${hiR.toFixed(1).padStart(6)} win=${(hiWin * 100).toFixed(0).padStart(4)}%`,
    );
  }

  // --- 6. Side breakdown ---
  console.log("\n6. SIDE BREAKDOWN: Does distToPoc work for both longs and shorts?\n");

  for (const side of ["long", "short"] as const) {
    const subset = completed.filter((t) => t.side === side);
    if (subset.length < 10) continue;
    const sorted = [...subset].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const half = Math.floor(sorted.length / 2);
    const loHalf = sorted.slice(0, half);
    const hiHalf = sorted.slice(half);
    const loR = loHalf.reduce((s, t) => s + t.r!, 0) / loHalf.length;
    const hiR = hiHalf.reduce((s, t) => s + t.r!, 0) / hiHalf.length;
    const loWin = loHalf.filter((t) => t.r! > 0).length / loHalf.length;
    const hiWin = hiHalf.filter((t) => t.r! > 0).length / hiHalf.length;
    console.log(
      `   side=${side.padEnd(6)} low distToPoc: n=${String(loHalf.length).padStart(3)} avg R=${loR.toFixed(1).padStart(6)} win=${(loWin * 100).toFixed(0).padStart(4)}% | high distToPoc: n=${String(hiHalf.length).padStart(3)} avg R=${hiR.toFixed(1).padStart(6)} win=${(hiWin * 100).toFixed(0).padStart(4)}%`,
    );
  }

  // --- 7. Mechanism hypothesis ---
  console.log("\n7. MECHANISM SUMMARY\n");
  const topPoc = sortedByPoc.slice(Math.floor(sortedByPoc.length * 0.8));
  const botPoc = sortedByPoc.slice(0, Math.floor(sortedByPoc.length * 0.2));
  const topAvgRange = topPoc.reduce((s, t) => s + t.entryContext.profileRange, 0) / topPoc.length;
  const botAvgRange = botPoc.reduce((s, t) => s + t.entryContext.profileRange, 0) / botPoc.length;
  const topAvgCvdHigh = topPoc.reduce((s, t) => s + (t.entryContext.cvd?.cvdHigh ?? 0), 0) / topPoc.length;
  const botAvgCvdHigh = botPoc.reduce((s, t) => s + (t.entryContext.cvd?.cvdHigh ?? 0), 0) / botPoc.length;
  const topAvgNodeVol = topPoc.reduce((s, t) => s + (t.entryContext.nearestNode?.volume ?? 0), 0) / topPoc.length;
  const botAvgNodeVol = botPoc.reduce((s, t) => s + (t.entryContext.nearestNode?.volume ?? 0), 0) / botPoc.length;
  const topAvgDistValLow = topPoc.reduce((s, t) => s + t.entryContext.priceDistanceToValueLow, 0) / topPoc.length;
  const botAvgDistValLow = botPoc.reduce((s, t) => s + t.entryContext.priceDistanceToValueLow, 0) / botPoc.length;

  console.log("   Top 20% distToPoc vs Bottom 20% distToPoc:");
  console.log(`   profileRange:       ${topAvgRange.toFixed(0)} vs ${botAvgRange.toFixed(0)} (ratio ${(topAvgRange / botAvgRange).toFixed(2)}x)`);
  console.log(`   cvdHigh:            ${topAvgCvdHigh.toFixed(1)} vs ${botAvgCvdHigh.toFixed(1)} (ratio ${(topAvgCvdHigh / (botAvgCvdHigh || 1)).toFixed(2)}x)`);
  console.log(`   nodeVolume:         ${topAvgNodeVol.toFixed(2)} vs ${botAvgNodeVol.toFixed(2)} (ratio ${(topAvgNodeVol / (botAvgNodeVol || 0.01)).toFixed(2)}x)`);
  console.log(`   distToValueLow:     ${topAvgDistValLow.toFixed(0)} vs ${botAvgDistValLow.toFixed(0)} (ratio ${(topAvgDistValLow / botAvgDistValLow).toFixed(2)}x)`);
  console.log(`   distToPoc:          ${topPoc[0] ? (topPoc.reduce((s, t) => s + t.entryContext.priceDistanceToPoc, 0) / topPoc.length).toFixed(0) : "?"} vs ${botPoc[0] ? (botPoc.reduce((s, t) => s + t.entryContext.priceDistanceToPoc, 0) / botPoc.length).toFixed(0) : "?"}`);
}

function analyzePocMigration(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null && t.pocSnapshots.length >= 2);
  console.log("\n=== POC MIGRATION ANALYSIS ===");
  console.log(`Trades with >= 2 POC snapshots: ${completed.length} of ${trades.length} total\n`);

  if (completed.length < 10) {
    console.log("  Not enough trades with POC snapshots for analysis.");
    return;
  }

  // Compute migration metrics for each trade
  type MigrationMetrics = {
    trade: Trade;
    entryPoc: number;
    entryPrice: number;
    exitPoc: number | null;
    pocDirectionToEntry: "toward" | "away" | "same";
    pocMigrationPct: number;
    priceAtSnapshots: number[];
    pocAtSnapshots: number[];
    timeMs: number[];
  };

  const metrics: MigrationMetrics[] = completed.map((t) => {
    const entryPoc = t.pocSnapshots[0].poc;
    const entryPriceRaw = t.pocSnapshots[0].price;
    const lastSnap = t.pocSnapshots[t.pocSnapshots.length - 1];
    const exitPoc = lastSnap.poc;

    // Direction: did POC move toward or away from entry price?
    const initialDist = Math.abs(entryPoc - entryPriceRaw);
    const finalDist = Math.abs(exitPoc - entryPriceRaw);
    let pocDir: "toward" | "away" | "same" = "same";
    if (finalDist < initialDist - 1) pocDir = "toward";
    else if (finalDist > initialDist + 1) pocDir = "away";

    // Migration as % of initial distance
    const migration = initialDist > 0 ? ((exitPoc - entryPoc) / initialDist) * 100 : 0;

    // For longs: POC moving up = toward entry (good)
    // For shorts: POC moving down = toward entry (good)
    // Normalize: positive = POC moved in favorable direction
    const favorable = t.side === "long" ? -(exitPoc - entryPoc) : (exitPoc - entryPoc);
    const favPct = initialDist > 0 ? (favorable / initialDist) * 100 : 0;

    return {
      trade: t,
      entryPoc,
      entryPrice: entryPriceRaw,
      exitPoc,
      pocDirectionToEntry: pocDir,
      pocMigrationPct: favPct,
      priceAtSnapshots: t.pocSnapshots.map((s) => s.price),
      pocAtSnapshots: t.pocSnapshots.map((s) => s.poc),
      timeMs: t.pocSnapshots.map((s) => s.ms),
    };
  });

  // --- 1. Overall migration direction ---
  console.log("1. POC MIGRATION DIRECTION (toward = POC moves toward entry price)");
  const toward = metrics.filter((m) => m.pocDirectionToEntry === "toward");
  const away = metrics.filter((m) => m.pocDirectionToEntry === "away");
  const same = metrics.filter((m) => m.pocDirectionToEntry === "same");
  const towardR = toward.reduce((s, m) => s + m.trade.r!, 0) / (toward.length || 1);
  const awayR = away.reduce((s, m) => s + m.trade.r!, 0) / (away.length || 1);
  const sameR = same.reduce((s, m) => s + m.trade.r!, 0) / (same.length || 1);
  console.log(`   Toward: ${String(toward.length).padStart(3)} trades, avg R=${towardR.toFixed(2).padStart(7)}`);
  console.log(`   Away:   ${String(away.length).padStart(3)} trades, avg R=${awayR.toFixed(2).padStart(7)}`);
  console.log(`   Same:   ${String(same.length).padStart(3)} trades, avg R=${sameR.toFixed(2).padStart(7)}`);

  // --- 2. Migration magnitude by R quintile ---
  console.log("\n2. POC MIGRATION BY R QUINTILE (favorable direction = positive)");
  const sorted = [...metrics].sort((a, b) => a.trade.r! - b.trade.r!);
  const qSize = Math.ceil(sorted.length / 5);
  const quintiles = [
    { label: "Bottom 20% (losers)", slice: sorted.slice(0, qSize) },
    { label: "Q2", slice: sorted.slice(qSize, qSize * 2) },
    { label: "Q3 (mid)", slice: sorted.slice(qSize * 2, qSize * 3) },
    { label: "Q4", slice: sorted.slice(qSize * 3, qSize * 4) },
    { label: "Top 20% (big winners)", slice: sorted.slice(qSize * 4) },
  ];

  console.log("   Group               | n  | Avg R   | Favorable migr% | Toward% | Avg |dist change|");
  console.log("   --------------------|----|---------|-----------------|---------|-------------------");
  for (const q of quintiles) {
    if (q.slice.length === 0) continue;
    const avgR = q.slice.reduce((s, m) => s + m.trade.r!, 0) / q.slice.length;
    const avgFav = q.slice.reduce((s, m) => s + m.pocMigrationPct, 0) / q.slice.length;
    const towardPct = q.slice.filter((m) => m.pocDirectionToEntry === "toward").length / q.slice.length * 100;
    const avgDistChange = q.slice.reduce((s, m) => {
      const init = Math.abs(m.entryPoc - m.entryPrice);
      const fin = m.exitPoc !== null ? Math.abs(m.exitPoc - m.entryPrice) : init;
      return s + Math.abs(fin - init);
    }, 0) / q.slice.length;
    const pctStr = towardPct.toFixed(0) + "%";
    console.log(
      "   " + q.label.padEnd(20) + "| " + String(q.slice.length).padStart(2) + " | " + avgR.toFixed(2).padStart(7) + " | " + avgFav.toFixed(1).padStart(15) + " | " + pctStr.padStart(7) + " | " + avgDistChange.toFixed(1).padStart(17),
    );
  }

  // --- 3. POC migration speed (first vs second half of snapshots) ---
  console.log("\n3. POC MIGRATION SPEED (early vs late migration)");
  const withSpeed = metrics.filter((m) => m.trade.pocSnapshots.length >= 3);
  if (withSpeed.length >= 5) {
    const midIdx = Math.floor(withSpeed[0].trade.pocSnapshots.length / 2);
    const earlyMig: number[] = [];
    const lateMig: number[] = [];
    for (const m of withSpeed) {
      const entryP = m.trade.pocSnapshots[0].price;
      let earlyDelta = 0;
      let lateDelta = 0;
      for (let i = 1; i < m.trade.pocSnapshots.length; i++) {
        const delta = Math.abs(m.trade.pocSnapshots[i].poc - entryP) - Math.abs(m.trade.pocSnapshots[i - 1].poc - entryP);
        if (i <= midIdx) earlyDelta += delta;
        else lateDelta += delta;
      }
      earlyMig.push(earlyDelta);
      lateMig.push(lateDelta);
    }
    const avgEarly = earlyMig.reduce((s, x) => s + x, 0) / earlyMig.length;
    const avgLate = lateMig.reduce((s, x) => s + x, 0) / lateMig.length;
    console.log(`   Early migration (first half):  avg dist change = ${avgEarly.toFixed(2)}`);
    console.log(`   Late migration (second half):  avg dist change = ${avgLate.toFixed(2)}`);
    console.log(`   Speed ratio (late/early):      ${(avgEarly !== 0 ? avgLate / avgEarly : 0).toFixed(2)}`);
  }

  // --- 4. Big winners vs losers: snapshot-by-snapshot comparison ---
  console.log("\n4. SNAPSHOT-BY-SNAPSHOT: POC distance from entry price over time");
  const bigWinners = metrics.filter((m) => m.trade.r! >= 10);
  const losers = metrics.filter((m) => m.trade.r! < 0);
  console.log(`   Big winners (R>=10): n=${bigWinners.length}, Losers (R<0): n=${losers.length}\n`);

  // Normalize time to 0-100% of trade duration
  const nBuckets = 5;
  console.log("   Time bucket | Big winner avg dist | Loser avg dist | Winner - Loser");
  console.log("   ------------|--------------------|----------------|---------------");
  for (let b = 0; b <= nBuckets; b++) {
    const pct = b / nBuckets;
    const getDistAtPct = (m: MigrationMetrics): number => {
      const snaps = m.trade.pocSnapshots;
      const idx = Math.min(Math.floor(pct * (snaps.length - 1)), snaps.length - 1);
      return Math.abs(snaps[idx].poc - snaps[idx].price);
    };
    const winDist = bigWinners.length > 0
      ? bigWinners.reduce((s, m) => s + getDistAtPct(m), 0) / bigWinners.length
      : 0;
    const loseDist = losers.length > 0
      ? losers.reduce((s, m) => s + getDistAtPct(m), 0) / losers.length
      : 0;
    const diff = winDist - loseDist;
    console.log(
      `   ${(pct * 100).toFixed(0).padStart(10)}%  | ${winDist.toFixed(1).padStart(18)} | ${loseDist.toFixed(1).padStart(14)} | ${diff.toFixed(1).padStart(13)}`,
    );
  }

  // --- 5. Summary ---
  console.log("\n5. SUMMARY");
  const allFav = metrics.map((m) => m.pocMigrationPct);
  const avgFavAll = allFav.reduce((s, x) => s + x, 0) / allFav.length;
  const winFav = bigWinners.map((m) => m.pocMigrationPct);
  const avgFavWin = winFav.length > 0 ? winFav.reduce((s, x) => s + x, 0) / winFav.length : 0;
  const loseFav = losers.map((m) => m.pocMigrationPct);
  const avgFavLose = loseFav.length > 0 ? loseFav.reduce((s, x) => s + x, 0) / loseFav.length : 0;
  console.log(`   Overall avg favorable migration: ${avgFavAll.toFixed(1)}%`);
  console.log(`   Big winners avg favorable:       ${avgFavWin.toFixed(1)}%`);
  console.log(`   Losers avg favorable:            ${avgFavLose.toFixed(1)}%`);
  console.log(`   Winner-loser gap:                ${(avgFavWin - avgFavLose).toFixed(1)}%`);
}

function analyzePocFailure(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null);
  console.log("\n=== HIGH distToPoc FAILURE ANALYSIS ===\n");

  // Top quintile by distToPoc
  const sorted = [...completed].sort((a, b) => b.entryContext.priceDistanceToPoc - a.entryContext.priceDistanceToPoc);
  const topN = Math.ceil(sorted.length * 0.2);
  const highPoc = sorted.slice(0, topN);
  const winners = highPoc.filter((t) => t.r! > 0);
  const losers = highPoc.filter((t) => t.r! <= 0);

  console.log(`High distToPoc trades (top 20%): ${highPoc.length}`);
  console.log(`  Winners (R>0): ${winners.length} (${(winners.length / highPoc.length * 100).toFixed(0)}%)`);
  console.log(`  Losers  (R<=0): ${losers.length} (${(losers.length / highPoc.length * 100).toFixed(0)}%)`);
  console.log(`  Winner avg R: ${(winners.reduce((s, t) => s + t.r!, 0) / winners.length).toFixed(2)}`);
  console.log(`  Loser avg R:  ${(losers.reduce((s, t) => s + t.r!, 0) / losers.length).toFixed(2)}`);

  // --- Feature comparison ---
  console.log("\n1. PRE-ENTRY FEATURE COMPARISON (winner vs loser within high distToPoc)");
  console.log("   Only features with >10% difference or clear separation shown.\n");

  type Row = { label: string; winVal: number; loseVal: number; diff: string; signal: string };
  const rows: Row[] = [];

  const numFeats: { label: string; extract: (t: Trade) => number }[] = [
    { label: "distToPoc", extract: (t) => t.entryContext.priceDistanceToPoc },
    { label: "profileRange", extract: (t) => t.entryContext.profileRange },
    { label: "distToValueHigh", extract: (t) => t.entryContext.priceDistanceToValueHigh },
    { label: "distToValueLow", extract: (t) => t.entryContext.priceDistanceToValueLow },
    { label: "nodeVolume", extract: (t) => t.entryContext.nearestNode?.volume ?? 0 },
    { label: "cvd", extract: (t) => t.entryContext.cvd?.cvd ?? 0 },
    { label: "cvdHigh", extract: (t) => t.entryContext.cvd?.cvdHigh ?? 0 },
    { label: "cvdLow", extract: (t) => t.entryContext.cvd?.cvdLow ?? 0 },
    { label: "priceChange", extract: (t) => t.entryContext.cvd?.priceChange ?? 0 },
    { label: "entryPrice", extract: (t) => t.entryPrice },
    { label: "binSize", extract: (t) => t.entryContext.binSize },
  ];

  for (const f of numFeats) {
    const wVals = winners.map((t) => f.extract(t));
    const lVals = losers.map((t) => f.extract(t));
    const wMean = wVals.reduce((s, x) => s + x, 0) / wVals.length;
    const lMean = lVals.reduce((s, x) => s + x, 0) / lVals.length;
    const pctDiff = lMean !== 0 ? ((wMean - lMean) / Math.abs(lMean)) * 100 : 0;
    const absDiff = Math.abs(pctDiff);
    if (absDiff < 10) continue;
    const signal = pctDiff > 0 ? "WINNERS HIGHER" : "LOSERS HIGHER";
    rows.push({ label: f.label, winVal: wMean, loseVal: lMean, diff: `${pctDiff > 0 ? "+" : ""}${pctDiff.toFixed(0)}%`, signal });
  }

  rows.sort((a, b) => Math.abs(parseFloat(b.diff)) - Math.abs(parseFloat(a.diff)));
  console.log("   Feature            | Winner avg  | Loser avg  | Diff    | Signal");
  console.log("   -------------------|-------------|------------|---------|------------");
  for (const r of rows) {
    console.log(
      `   ${r.label.padEnd(19)}| ${r.winVal.toFixed(2).padStart(11)} | ${r.loseVal.toFixed(2).padStart(10)} | ${r.diff.padStart(7)} | ${r.signal}`,
    );
  }

  // --- Categorical breakdown ---
  console.log("\n2. CATEGORICAL BREAKDOWN (failure rate within high distToPoc)");

  type CatFeat = { label: string; extract: (t: Trade) => string };
  const catFeats: CatFeat[] = [
    { label: "cvdTrend", extract: (t) => t.entryContext.cvd?.cvdTrend ?? "?" },
    { label: "cvdDivergence", extract: (t) => t.entryContext.cvd?.priceCvdDivergence ?? "?" },
    { label: "action", extract: (t) => t.entryContext.action },
    { label: "location", extract: (t) => t.entryContext.location },
    { label: "side", extract: (t) => t.side },
    { label: "nodeKind", extract: (t) => t.entryContext.nearestNode?.kind ?? "?" },
  ];

  console.log("   Feature          | Category    | n  | Wins | Losses | Fail%  | Avg R");
  console.log("   -----------------|-------------|----|------|--------|--------|--------");
  for (const f of catFeats) {
    const cats = new Set(highPoc.map((t) => f.extract(t)));
    for (const cat of cats) {
      const subset = highPoc.filter((t) => f.extract(t) === cat);
      const w = subset.filter((t) => t.r! > 0).length;
      const l = subset.filter((t) => t.r! <= 0).length;
      const failRate = subset.length > 0 ? (l / subset.length * 100) : 0;
      const avgR = subset.reduce((s, t) => s + t.r!, 0) / subset.length;
      const failStr = failRate.toFixed(0) + "%";
      console.log(
        "   " + f.label.padEnd(17) + "| " + cat.padEnd(11) + " | " + String(subset.length).padStart(2) + " | " + String(w).padStart(4) + " | " + String(l).padStart(6) + " | " + failStr.padStart(6) + " | " + avgR.toFixed(1).padStart(6),
      );
    }
  }

  // --- Cross-tab: distToPoc x cvdTrend failure rate ---
  console.log("\n3. FAILURE RATE: distToPoc x cvdTrend (full population)");
  const trendGroups = ["rising", "falling"] as const;
  for (const trend of trendGroups) {
    const allTrend = completed.filter((t) => t.entryContext.cvd?.cvdTrend === trend);
    const half = Math.floor(allTrend.length / 2);
    const sortedT = [...allTrend].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const lo = sortedT.slice(0, half);
    const hi = sortedT.slice(half);
    const loFail = lo.filter((t) => t.r! <= 0).length / lo.length * 100;
    const hiFail = hi.filter((t) => t.r! <= 0).length / hi.length * 100;
    const loR = lo.reduce((s, t) => s + t.r!, 0) / lo.length;
    const hiR = hi.reduce((s, t) => s + t.r!, 0) / hi.length;
    console.log(
      `   ${trend.padEnd(8)} low distToPoc: fail=${loFail.toFixed(0).padStart(4)}% avg R=${loR.toFixed(1).padStart(6)} | high distToPoc: fail=${hiFail.toFixed(0).padStart(4)}% avg R=${hiR.toFixed(1).padStart(6)}`,
    );
  }

  // --- Cross-tab: distToPoc x action failure rate ---
  console.log("\n4. FAILURE RATE: distToPoc x action (full population)");
  const actionGroups = ["discovering", "rejecting"] as const;
  for (const action of actionGroups) {
    const allAction = completed.filter((t) => t.entryContext.action === action);
    const half = Math.floor(allAction.length / 2);
    const sortedA = [...allAction].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const lo = sortedA.slice(0, half);
    const hi = sortedA.slice(half);
    const loFail = lo.filter((t) => t.r! <= 0).length / lo.length * 100;
    const hiFail = hi.filter((t) => t.r! <= 0).length / hi.length * 100;
    const loR = lo.reduce((s, t) => s + t.r!, 0) / lo.length;
    const hiR = hi.reduce((s, t) => s + t.r!, 0) / hi.length;
    console.log(
      `   ${action.padEnd(13)} low distToPoc: fail=${loFail.toFixed(0).padStart(4)}% avg R=${loR.toFixed(1).padStart(6)} | high distToPoc: fail=${hiFail.toFixed(0).padStart(4)}% avg R=${hiR.toFixed(1).padStart(6)}`,
    );
  }

  // --- Cross-tab: distToPoc x side failure rate ---
  console.log("\n5. FAILURE RATE: distToPoc x side (full population)");
  for (const side of ["long", "short"] as const) {
    const allSide = completed.filter((t) => t.side === side);
    const half = Math.floor(allSide.length / 2);
    const sortedS = [...allSide].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
    const lo = sortedS.slice(0, half);
    const hi = sortedS.slice(half);
    const loFail = lo.filter((t) => t.r! <= 0).length / lo.length * 100;
    const hiFail = hi.filter((t) => t.r! <= 0).length / hi.length * 100;
    const loR = lo.reduce((s, t) => s + t.r!, 0) / lo.length;
    const hiR = hi.reduce((s, t) => s + t.r!, 0) / hi.length;
    console.log(
      `   ${side.padEnd(6)} low distToPoc: fail=${loFail.toFixed(0).padStart(4)}% avg R=${loR.toFixed(1).padStart(6)} | high distToPoc: fail=${hiFail.toFixed(0).padStart(4)}% avg R=${hiR.toFixed(1).padStart(6)}`,
    );
  }
}

function analyzeCvdFilter(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null && t.entryContext.cvd !== null);
  console.log("\n=== CVD FILTER ANALYSIS ===");
  console.log("For each CVD threshold, filter trades with CVD >= threshold and report metrics.\n");

  const allWinners = completed.filter((t) => t.r! > 0);
  const allLosers = completed.filter((t) => t.r! <= 0);
  const totalWinR = allWinners.reduce((s, t) => s + t.r!, 0);
  const totalLossR = Math.abs(allLosers.reduce((s, t) => s + t.r!, 0));

  console.log("All trades: " + completed.length + ", Winners: " + allWinners.length + ", Losers: " + allLosers.length);
  console.log("Baseline: win rate=" + (allWinners.length / completed.length * 100).toFixed(1) + "%, avg R=" + (completed.reduce((s, t) => s + t.r!, 0) / completed.length).toFixed(2) + ", PF=" + (totalLossR > 0 ? (totalWinR / totalLossR).toFixed(2) : "inf"));
  console.log();

  // Compute CVD percentiles
  const cvdVals = completed.map((t) => t.entryContext.cvd!.cvd).sort((a, b) => a - b);
  const percentile = (p: number): number => {
    const idx = Math.floor(p * cvdVals.length);
    return cvdVals[Math.min(idx, cvdVals.length - 1)];
  };

  // Test thresholds: P0, P10, P20, ..., P90, plus specific CVD values
  const thresholds: { label: string; value: number }[] = [];
  for (let p = 0; p <= 90; p += 10) {
    thresholds.push({ label: "P" + String(p), value: percentile(p / 100) });
  }
  const specificVals = [0, 5, 10, 15, 20, 25, 30, 40, 50];
  for (const v of specificVals) {
    if (!thresholds.some((t) => Math.abs(t.value - v) < 1)) {
      thresholds.push({ label: "cvd>=" + String(v), value: v });
    }
  }
  thresholds.sort((a, b) => a.value - b.value);

  // Remove duplicates
  const unique: typeof thresholds = [];
  for (const t of thresholds) {
    if (unique.length === 0 || Math.abs(unique[unique.length - 1].value - t.value) > 0.5) {
      unique.push(t);
    }
  }

  console.log("Threshold   | CVD val | Trades | Win%  | Avg R  | PF    | Max DD | Total R | Losers kept | Winners kept");
  console.log("------------|---------|--------|-------|--------|-------|--------|---------|-------------|-------------");

  const baseMaxDD = computeMaxDD(completed);
  const baseTotalR = completed.reduce((s, t) => s + t.r!, 0);
  console.log("ALL (no filt|    -    | " + String(completed.length).padStart(6) + " | " + (allWinners.length / completed.length * 100).toFixed(0).padStart(4) + "% | " + (baseTotalR / completed.length).toFixed(2).padStart(6) + " | " + (totalLossR > 0 ? (totalWinR / totalLossR).toFixed(1) : "inf").padStart(5) + " | " + baseMaxDD.toFixed(0).padStart(6) + " | " + baseTotalR.toFixed(0).padStart(7) + " |          100% |          100%");

  for (const thr of unique) {
    const filtered = completed.filter((t) => t.entryContext.cvd!.cvd >= thr.value);
    if (filtered.length < 3) continue;
    const fWins = filtered.filter((t) => t.r! > 0);
    const fLosses = filtered.filter((t) => t.r! <= 0);
    const fWinR = fWins.reduce((s, t) => s + t.r!, 0);
    const fLossR = Math.abs(fLosses.reduce((s, t) => s + t.r!, 0));
    const pf = fLossR > 0 ? (fWinR / fLossR).toFixed(1) : "inf";
    const maxDD = computeMaxDD(filtered);
    const totalR = filtered.reduce((s, t) => s + t.r!, 0);
    const losersKept = allLosers.length > 0 ? (fLosses.length / allLosers.length * 100).toFixed(0) : "0";
    const winnersKept = allWinners.length > 0 ? (fWins.length / allWinners.length * 100).toFixed(0) : "0";

    const label = (thr.label + "       ").slice(0, 11);
    console.log(
      label + " | " + thr.value.toFixed(0).padStart(7) + " | " + String(filtered.length).padStart(6) + " | " + (fWins.length / filtered.length * 100).toFixed(0).padStart(4) + "% | " + (totalR / filtered.length).toFixed(2).padStart(6) + " | " + pf.padStart(5) + " | " + maxDD.toFixed(0).padStart(6) + " | " + totalR.toFixed(0).padStart(7) + " | " + (losersKept + "%").padStart(11) + " | " + (winnersKept + "%").padStart(11),
    );
  }

  // --- CVD filter on high distToPoc only ---
  console.log("\n--- CVD filter WITHIN high distToPoc (top 20%) ---\n");
  const sortedPoc = [...completed].sort((a, b) => b.entryContext.priceDistanceToPoc - a.entryContext.priceDistanceToPoc);
  const topN = Math.ceil(sortedPoc.length * 0.2);
  const highPoc = sortedPoc.slice(0, topN);
  const hpWins = highPoc.filter((t) => t.r! > 0);
  const hpLosses = highPoc.filter((t) => t.r! <= 0);
  const hpWinR = hpWins.reduce((s, t) => s + t.r!, 0);
  const hpLossR = Math.abs(hpLosses.reduce((s, t) => s + t.r!, 0));
  const hpTotalR = highPoc.reduce((s, t) => s + t.r!, 0);

  console.log("ALL high distToPoc (no CVD filter):");
  console.log("  Trades: " + highPoc.length + ", Win%: " + (hpWins.length / highPoc.length * 100).toFixed(1) + "%, Avg R: " + (hpTotalR / highPoc.length).toFixed(2) + ", PF: " + (hpLossR > 0 ? (hpWinR / hpLossR).toFixed(2) : "inf") + ", Total R: " + hpTotalR.toFixed(0));
  console.log();
  console.log("Threshold   | CVD val | Trades | Win%  | Avg R  | PF    | Max DD | Total R | Losers kept | Winners kept");
  console.log("------------|---------|--------|-------|--------|-------|--------|---------|-------------|-------------");

  for (const thr of unique) {
    const filtered = highPoc.filter((t) => t.entryContext.cvd!.cvd >= thr.value);
    if (filtered.length < 2) continue;
    const fWins = filtered.filter((t) => t.r! > 0);
    const fLosses = filtered.filter((t) => t.r! <= 0);
    const fWinR = fWins.reduce((s, t) => s + t.r!, 0);
    const fLossR = Math.abs(fLosses.reduce((s, t) => s + t.r!, 0));
    const pf = fLossR > 0 ? (fWinR / fLossR).toFixed(1) : "inf";
    const maxDD = computeMaxDD(filtered);
    const totalR = filtered.reduce((s, t) => s + t.r!, 0);
    const losersKept = hpLosses.length > 0 ? (fLosses.length / hpLosses.length * 100).toFixed(0) : "0";
    const winnersKept = hpWins.length > 0 ? (fWins.length / hpWins.length * 100).toFixed(0) : "0";

    const label = (thr.label + "       ").slice(0, 11);
    console.log(
      label + " | " + thr.value.toFixed(0).padStart(7) + " | " + String(filtered.length).padStart(6) + " | " + (fWins.length / filtered.length * 100).toFixed(0).padStart(4) + "% | " + (filtered.length > 0 ? (totalR / filtered.length).toFixed(2) : "0").padStart(6) + " | " + pf.padStart(5) + " | " + maxDD.toFixed(0).padStart(6) + " | " + totalR.toFixed(0).padStart(7) + " | " + (losersKept + "%").padStart(11) + " | " + (winnersKept + "%").padStart(11),
    );
  }
}

function computeMaxDD(trades: Trade[]): number {
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  for (const t of trades) {
    equity += t.r!;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function analyzeCvdDistribution(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null && t.entryContext.cvd !== null);
  console.log("\n=== CVD DISTRIBUTION ANALYSIS ===\n");

  const cvdVals = completed.map((t) => t.entryContext.cvd!.cvd).sort((a, b) => a - b);
  const absVals = cvdVals.map((v) => Math.abs(v)).sort((a, b) => a - b);

  const mean = cvdVals.reduce((s, x) => s + x, 0) / cvdVals.length;
  const medianVal = cvdVals[Math.floor(cvdVals.length / 2)];
  const variance = cvdVals.reduce((s, x) => s + (x - mean) ** 2, 0) / cvdVals.length;
  const std = Math.sqrt(variance);
  const avgAbs = absVals.reduce((s, x) => s + x, 0) / absVals.length;
  const maxAbs = absVals[absVals.length - 1];

  const pct = (p: number): number => cvdVals[Math.min(Math.floor(p * cvdVals.length), cvdVals.length - 1)];

  console.log("CVD Distribution Stats:");
  console.log("  Mean:              " + mean.toFixed(2));
  console.log("  Median:            " + medianVal.toFixed(2));
  console.log("  Std deviation:     " + std.toFixed(2));
  console.log("  Avg |CVD|:         " + avgAbs.toFixed(2));
  console.log("  Max |CVD|:         " + maxAbs.toFixed(2));
  console.log("  P10:               " + pct(0.1).toFixed(2));
  console.log("  P25:               " + pct(0.25).toFixed(2));
  console.log("  P50:               " + pct(0.5).toFixed(2));
  console.log("  P75:               " + pct(0.75).toFixed(2));
  console.log("  P90:               " + pct(0.9).toFixed(2));

  // What percentile is cvd=25?
  const cvd25Idx = cvdVals.findIndex((v) => v >= 25);
  const cvd25Pct = cvd25Idx >= 0 ? (cvd25Idx / cvdVals.length * 100).toFixed(1) : "N/A";
  const cvd50Idx = cvdVals.findIndex((v) => v >= 50);
  const cvd50Pct = cvd50Idx >= 0 ? (cvd50Idx / cvdVals.length * 100).toFixed(1) : "N/A";
  console.log("\nAbsolute threshold mapping:");
  console.log("  cvd=25 is approximately P" + cvd25Pct + " (" + (cvd25Idx >= 0 ? cvdVals[cvd25Idx].toFixed(0) : "?") + ")");
  console.log("  cvd=50 is approximately P" + cvd50Pct + " (" + (cvd50Idx >= 0 ? cvdVals[cvd50Idx].toFixed(0) : "?") + ")");

  // --- Percentile-normalized filter analysis ---
  console.log("\n--- Percentile-Normalized CVD Filter ---");
  console.log("Using P25, P50, P75, P90 as thresholds (same percentile in any distribution).\n");

  const allWinners = completed.filter((t) => t.r! > 0);
  const allLosers = completed.filter((t) => t.r! <= 0);
  const totalWinR = allWinners.reduce((s, t) => s + t.r!, 0);
  const totalLossR = Math.abs(allLosers.reduce((s, t) => s + t.r!, 0));
  const baseMaxDD = computeMaxDD(completed);
  const baseTotalR = completed.reduce((s, t) => s + t.r!, 0);

  console.log("ALL (no filter):");
  console.log("  Trades: " + completed.length + ", Win%: " + (allWinners.length / completed.length * 100).toFixed(1) + "%, Avg R: " + (baseTotalR / completed.length).toFixed(2) + ", PF: " + (totalLossR > 0 ? (totalWinR / totalLossR).toFixed(1) : "inf") + ", MaxDD: " + baseMaxDD.toFixed(0) + ", Total R: " + baseTotalR.toFixed(0));
  console.log();

  console.log("Threshold   | CVD val | Pctl | Trades | Win%  | Avg R  | PF    | Max DD | Total R | Losers kept | Winners kept");
  console.log("------------|---------|------|--------|-------|--------|-------|--------|---------|-------------|-------------");

  const percentiles = [25, 50, 75, 90];
  for (const p of percentiles) {
    const thr = pct(p / 100);
    const filtered = completed.filter((t) => t.entryContext.cvd!.cvd >= thr);
    if (filtered.length < 3) continue;
    const fWins = filtered.filter((t) => t.r! > 0);
    const fLosses = filtered.filter((t) => t.r! <= 0);
    const fWinR = fWins.reduce((s, t) => s + t.r!, 0);
    const fLossR = Math.abs(fLosses.reduce((s, t) => s + t.r!, 0));
    const pf = fLossR > 0 ? (fWinR / fLossR).toFixed(1) : "inf";
    const maxDD = computeMaxDD(filtered);
    const totalR = filtered.reduce((s, t) => s + t.r!, 0);
    const losersKept = allLosers.length > 0 ? (fLosses.length / allLosers.length * 100).toFixed(0) : "0";
    const winnersKept = allWinners.length > 0 ? (fWins.length / allWinners.length * 100).toFixed(0) : "0";

    const label = ("P" + String(p) + "       ").slice(0, 11);
    console.log(
      label + " | " + thr.toFixed(0).padStart(7) + " | " + ("P" + String(p)).padStart(4) + " | " + String(filtered.length).padStart(6) + " | " + (fWins.length / filtered.length * 100).toFixed(0).padStart(4) + "% | " + (totalR / filtered.length).toFixed(2).padStart(6) + " | " + pf.padStart(5) + " | " + maxDD.toFixed(0).padStart(6) + " | " + totalR.toFixed(0).padStart(7) + " | " + (losersKept + "%").padStart(11) + " | " + (winnersKept + "%").padStart(11),
    );
  }

  // Also show absolute cvd=25 for comparison
  const abs25 = completed.filter((t) => t.entryContext.cvd!.cvd >= 25);
  if (abs25.length >= 3) {
    const fWins = abs25.filter((t) => t.r! > 0);
    const fLosses = abs25.filter((t) => t.r! <= 0);
    const fWinR = fWins.reduce((s, t) => s + t.r!, 0);
    const fLossR = Math.abs(fLosses.reduce((s, t) => s + t.r!, 0));
    const pf = fLossR > 0 ? (fWinR / fLossR).toFixed(1) : "inf";
    const maxDD = computeMaxDD(abs25);
    const totalR = abs25.reduce((s, t) => s + t.r!, 0);
    const losersKept = allLosers.length > 0 ? (fLosses.length / allLosers.length * 100).toFixed(0) : "0";
    const winnersKept = allWinners.length > 0 ? (fWins.length / allWinners.length * 100).toFixed(0) : "0";
    console.log(
      "cvd>=25     |      25 |  abs | " + String(abs25.length).padStart(6) + " | " + (fWins.length / abs25.length * 100).toFixed(0).padStart(4) + "% | " + (totalR / abs25.length).toFixed(2).padStart(6) + " | " + pf.padStart(5) + " | " + maxDD.toFixed(0).padStart(6) + " | " + totalR.toFixed(0).padStart(7) + " | " + (losersKept + "%").padStart(11) + " | " + (winnersKept + "%").padStart(11),
    );
  }

  // --- Within high distToPoc ---
  console.log("\n--- Percentile-Normalized CVD Filter WITHIN high distToPoc (top 20%) ---\n");
  const sortedPoc = [...completed].sort((a, b) => b.entryContext.priceDistanceToPoc - a.entryContext.priceDistanceToPoc);
  const topN = Math.ceil(sortedPoc.length * 0.2);
  const highPoc = sortedPoc.slice(0, topN);
  const hpWins = highPoc.filter((t) => t.r! > 0);
  const hpLosses = highPoc.filter((t) => t.r! <= 0);
  const hpWinR = hpWins.reduce((s, t) => s + t.r!, 0);
  const hpLossR = Math.abs(hpLosses.reduce((s, t) => s + t.r!, 0));
  const hpTotalR = highPoc.reduce((s, t) => s + t.r!, 0);

  console.log("ALL high distToPoc (no CVD filter):");
  console.log("  Trades: " + highPoc.length + ", Win%: " + (hpWins.length / highPoc.length * 100).toFixed(1) + "%, Avg R: " + (hpTotalR / highPoc.length).toFixed(2) + ", PF: " + (hpLossR > 0 ? (hpWinR / hpLossR).toFixed(2) : "inf") + ", Total R: " + hpTotalR.toFixed(0));
  console.log();

  console.log("Threshold   | CVD val | Pctl | Trades | Win%  | Avg R  | PF    | Max DD | Total R | Losers kept | Winners kept");
  console.log("------------|---------|------|--------|-------|--------|-------|--------|---------|-------------|-------------");

  for (const p of percentiles) {
    const thr = pct(p / 100);
    const filtered = highPoc.filter((t) => t.entryContext.cvd!.cvd >= thr);
    if (filtered.length < 2) continue;
    const fWins = filtered.filter((t) => t.r! > 0);
    const fLosses = filtered.filter((t) => t.r! <= 0);
    const fWinR = fWins.reduce((s, t) => s + t.r!, 0);
    const fLossR = Math.abs(fLosses.reduce((s, t) => s + t.r!, 0));
    const pf = fLossR > 0 ? (fWinR / fLossR).toFixed(1) : "inf";
    const maxDD = computeMaxDD(filtered);
    const totalR = filtered.reduce((s, t) => s + t.r!, 0);
    const losersKept = hpLosses.length > 0 ? (fLosses.length / hpLosses.length * 100).toFixed(0) : "0";
    const winnersKept = hpWins.length > 0 ? (fWins.length / hpWins.length * 100).toFixed(0) : "0";

    const label = ("P" + String(p) + "       ").slice(0, 11);
    console.log(
      label + " | " + thr.toFixed(0).padStart(7) + " | " + ("P" + String(p)).padStart(4) + " | " + String(filtered.length).padStart(6) + " | " + (fWins.length / filtered.length * 100).toFixed(0).padStart(4) + "% | " + (filtered.length > 0 ? (totalR / filtered.length).toFixed(2) : "0").padStart(6) + " | " + pf.padStart(5) + " | " + maxDD.toFixed(0).padStart(6) + " | " + totalR.toFixed(0).padStart(7) + " | " + (losersKept + "%").padStart(11) + " | " + (winnersKept + "%").padStart(11),
    );
  }
}

function analyzeTemporalFeatures(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null);
  console.log("\n=== TEMPORAL FEATURE ANALYSIS ===");
  console.log("Comparing pre-entry temporal features (last 120s of orderflow) against static snapshot features.\n");

  // --- 1. Feature discrimination: top 20% winners vs rest ---
  console.log("1. DISCRIMINATION: Top 20% winners vs rest (all features)");
  console.log("   Effect size = |Cohen's d| for numeric features.\n");

  const sorted = [...completed].sort((a, b) => b.r! - a.r!);
  const topN = Math.ceil(sorted.length * 0.2);
  const big = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  type FeatRow = { feature: string; category: string; bigMean: number; restMean: number; effectSize: number };
  const rows: FeatRow[] = [];

  const meanFn = (vals: number[]) => vals.length > 0 ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  const cohenD = (a: number[], b: number[]): number => {
    if (a.length < 2 || b.length < 2) return 0;
    const mA = meanFn(a);
    const mB = meanFn(b);
    const vA = a.reduce((s, x) => s + (x - mA) ** 2, 0) / (a.length - 1);
    const vB = b.reduce((s, x) => s + (x - mB) ** 2, 0) / (b.length - 1);
    const pStd = Math.sqrt(((a.length - 1) * vA + (b.length - 1) * vB) / (a.length + b.length - 2));
    return pStd > 0 ? Math.abs(mA - mB) / pStd : 0;
  };

  // Static features
  const staticFeats: { label: string; extract: (t: Trade) => number }[] = [
    { label: "distToPoc", extract: (t) => t.entryContext.priceDistanceToPoc },
    { label: "profileRange", extract: (t) => t.entryContext.profileRange },
    { label: "cvd", extract: (t) => t.entryContext.cvd?.cvd ?? 0 },
    { label: "cvdHigh", extract: (t) => t.entryContext.cvd?.cvdHigh ?? 0 },
    { label: "priceChange", extract: (t) => t.entryContext.cvd?.priceChange ?? 0 },
    { label: "nodeVolume", extract: (t) => t.entryContext.nearestNode?.volume ?? 0 },
    { label: "distToValueLow", extract: (t) => t.entryContext.priceDistanceToValueLow },
  ];

  // Temporal features
  const temporalFeats: { label: string; extract: (t: Trade) => number }[] = [
    { label: "cvdSlope", extract: (t) => t.temporal.cvdSlope },
    { label: "cvdAcceleration", extract: (t) => t.temporal.cvdAcceleration },
    { label: "cvdSignChanges", extract: (t) => t.temporal.cvdSignChanges },
    { label: "cvdLongestRun", extract: (t) => t.temporal.cvdLongestRun },
    { label: "cvdImpulseCount", extract: (t) => t.temporal.cvdImpulseCount },
    { label: "cvdAvgImpulse", extract: (t) => t.temporal.cvdAvgImpulse },
    { label: "priceVelocity", extract: (t) => t.temporal.priceVelocity },
    { label: "priceAcceleration", extract: (t) => t.temporal.priceAcceleration },
    { label: "priceLargestImpulse", extract: (t) => t.temporal.priceLargestImpulse },
    { label: "priceRetracement", extract: (t) => t.temporal.priceRetracement },
    { label: "buySellRatio", extract: (t) => t.temporal.buySellRatio },
    { label: "volumeSlope", extract: (t) => t.temporal.volumeSlope },
    { label: "tradeRate", extract: (t) => t.temporal.tradeRate },
    { label: "deltaPersistence", extract: (t) => t.temporal.deltaPersistence },
    { label: "upCloseRatio", extract: (t) => t.temporal.upCloseRatio },
  ];

  for (const f of staticFeats) {
    const bV = big.map((t) => f.extract(t));
    const rV = rest.map((t) => f.extract(t));
    rows.push({ feature: f.label, category: "static", bigMean: meanFn(bV), restMean: meanFn(rV), effectSize: cohenD(bV, rV) });
  }
  for (const f of temporalFeats) {
    const bV = big.map((t) => f.extract(t));
    const rV = rest.map((t) => f.extract(t));
    rows.push({ feature: f.label, category: "temporal", bigMean: meanFn(bV), restMean: meanFn(rV), effectSize: cohenD(bV, rV) });
  }

  rows.sort((a, b) => b.effectSize - a.effectSize);

  console.log("   Rank | Feature            | Type    | Top20% avg | Rest avg  | |d|");
  console.log("   -----|--------------------|---------|------------|-----------|------");
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.effectSize < 0.05) continue;
    const marker = r.category === "temporal" ? " ***" : "";
    console.log(
      "   " + String(i + 1).padStart(4) + " | " + r.feature.padEnd(18) + " | " + r.category.padEnd(7) + " | " + r.bigMean.toFixed(2).padStart(10) + " | " + r.restMean.toFixed(2).padStart(9) + " | " + r.effectSize.toFixed(4).padStart(6) + marker,
    );
  }

  // --- 2. Independence check: does distToPoc explain temporal features? ---
  console.log("\n2. INDEPENDENCE: Correlation between distToPoc and temporal features");
  console.log("   If r > 0.5, the temporal feature may be a proxy for distToPoc.\n");

  const pocVals = completed.map((t) => t.entryContext.priceDistanceToPoc);
  const pocM = meanFn(pocVals);

  console.log("   Feature            | Pearson r | Independent?");
  console.log("   --------------------|-----------|-------------");
  for (const f of temporalFeats) {
    const fVals = completed.map((t) => f.extract(t));
    const fM = meanFn(fVals);
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = 0; i < completed.length; i++) {
      const dx = pocVals[i] - pocM;
      const dy = fVals[i] - fM;
      num += dx * dy;
      denA += dx * dx;
      denB += dy * dy;
    }
    const r = denA > 0 && denB > 0 ? num / Math.sqrt(denA * denB) : 0;
    const independent = Math.abs(r) < 0.3 ? "YES" : Math.abs(r) < 0.5 ? "WEAK" : "PROXY";
    console.log("   " + f.label.padEnd(18) + " | " + r.toFixed(3).padStart(9) + " | " + independent);
  }

  // --- 3. Partial effect: temporal features within distToPoc deciles ---
  console.log("\n3. PARTIAL EFFECT: Do temporal features predict R WITHIN distToPoc deciles?");
  console.log("   Within each distToPoc decile, compare high vs low temporal feature.\n");

  const keyTemporal = [
    { label: "cvdSlope", extract: (t: Trade) => t.temporal.cvdSlope },
    { label: "priceVelocity", extract: (t: Trade) => t.temporal.priceVelocity },
    { label: "cvdLongestRun", extract: (t: Trade) => t.temporal.cvdLongestRun },
    { label: "deltaPersistence", extract: (t: Trade) => t.temporal.deltaPersistence },
    { label: "buySellRatio", extract: (t: Trade) => t.temporal.buySellRatio },
  ];

  const byPoc = [...completed].sort((a, b) => a.entryContext.priceDistanceToPoc - b.entryContext.priceDistanceToPoc);
  const decSize = Math.ceil(byPoc.length / 5);

  for (const tf of keyTemporal) {
    console.log("   " + tf.label + ":");
    for (let d = 0; d < 5; d++) {
      const slice = byPoc.slice(d * decSize, Math.min((d + 1) * decSize, byPoc.length));
      if (slice.length < 4) continue;
      const vals = slice.map((t) => tf.extract(t));
      const med = median(vals);
      const lo = slice.filter((t) => tf.extract(t) <= med);
      const hi = slice.filter((t) => tf.extract(t) > med);
      const loR = lo.reduce((s, t) => s + t.r!, 0) / lo.length;
      const hiR = hi.reduce((s, t) => s + t.r!, 0) / hi.length;
      const diff = hiR - loR;
      const arrow = diff > 2 ? "++" : diff > 0 ? "+" : diff < -2 ? "--" : diff < 0 ? "-" : "=";
      console.log("     POC Q" + String(d + 1) + " (n=" + String(slice.length).padStart(3) + "): low=" + loR.toFixed(1).padStart(7) + " high=" + hiR.toFixed(1).padStart(7) + " diff=" + diff.toFixed(1).padStart(7) + " " + arrow);
    }
    console.log();
  }

  // --- 4. Response curves for top temporal features ---
  console.log("4. RESPONSE CURVES: Top temporal features by decile");
  console.log("   Equal-frequency bins. Monotonicity score shown.\n");

  for (const tf of keyTemporal) {
    const vals = completed.map((t) => tf.extract(t));
    const sortedVals = [...vals].sort((a, b) => a - b);
    const binSize = Math.ceil(sortedVals.length / 10);
    const bins: { label: string; avgR: number; count: number; winRate: number }[] = [];

    for (let b = 0; b < 10; b++) {
      const lo = sortedVals[b * binSize];
      const hi = sortedVals[Math.min((b + 1) * binSize - 1, sortedVals.length - 1)];
      if (lo === undefined) break;
      const inBin = completed.filter((t) => {
        const v = tf.extract(t);
        if (b === 0) return v <= hi;
        if (b === 9) return v >= lo;
        return v >= lo && v <= hi;
      });
      if (inBin.length === 0) continue;
      bins.push({
        label: b === 0 ? "< " + hi.toFixed(1) : b === 9 ? ">= " + lo.toFixed(1) : lo.toFixed(1) + "-" + hi.toFixed(1),
        avgR: inBin.reduce((s, t) => s + t.r!, 0) / inBin.length,
        count: inBin.length,
        winRate: inBin.filter((t) => t.r! > 0).length / inBin.length,
      });
    }

    const avgRs = bins.map((b) => b.avgR);
    const mono = monotonicityScore(avgRs);
    const rho = spearmanRho(avgRs, bins.map((_, i) => i));
    const monoLabel = mono > 0.6 ? "STRONG +" : mono > 0.3 ? "mod +" : mono < -0.6 ? "STRONG -" : mono < -0.3 ? "mod -" : "weak";

    console.log("   " + tf.label + "  monotonicity=" + mono.toFixed(2) + " (" + monoLabel + ")  spearman=" + rho.toFixed(3));
    console.log("   Bin              | Count | Win%  | Avg R");
    console.log("   -----------------|-------|-------|--------");
    for (const b of bins) {
      console.log(
        "   " + b.label.padEnd(17) + "| " + String(b.count).padStart(5) + " | " + (b.winRate * 100).toFixed(0).padStart(5) + " | " + b.avgR.toFixed(1).padStart(6),
      );
    }
    console.log();
  }
}

function analyzeEventSequences(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null && t.eventSequence.events.length > 0);
  console.log("\n=== EVENT SEQUENCE ANALYSIS ===");
  console.log("Trades with events detected: " + completed.length + " of " + trades.length);
  console.log("Event vocabulary: IMPULSE_START, EXHAUSTION, REVERSAL, ABSORPTION, PULLBACK, ACCEPTANCE, RATE_EXPANDS, RATE_CONTRACTS\n");

  // --- 1. Event frequency by outcome ---
  console.log("1. EVENT FREQUENCY: Which events occur more before winners?");
  const winners = completed.filter((t) => t.r! > 0);
  const losers = completed.filter((t) => t.r! <= 0);

  const eventTypes = ["IMPULSE_START", "EXHAUSTION", "REVERSAL", "ABSORPTION", "PULLBACK", "ACCEPTANCE", "RATE_EXPANDS", "RATE_CONTRACTS"];
  const sides = ["buy", "sell", "neutral"];

  console.log("   Event                | Win freq | Lose freq | Diff   | Signal");
  console.log("   ---------------------|----------|-----------|--------|--------");

  for (const evt of eventTypes) {
    for (const side of sides) {
      const wCount = winners.filter((t) => t.eventSequence.events.some((e) => e.type === evt && e.side === side)).length;
      const lCount = losers.filter((t) => t.eventSequence.events.some((e) => e.type === evt && e.side === side)).length;
      const wFreq = winners.length > 0 ? wCount / winners.length : 0;
      const lFreq = losers.length > 0 ? lCount / losers.length : 0;
      const diff = wFreq - lFreq;
      if (wFreq < 0.02 && lFreq < 0.02) continue;
      const label = (side !== "neutral" ? side + "_" + evt : evt);
      const signal = diff > 0.05 ? "MORE IN WINNERS" : diff < -0.05 ? "MORE IN LOSERS" : "";
      console.log(
        "   " + label.padEnd(21) + " | " + (wFreq * 100).toFixed(0).padStart(7) + "% | " + (lFreq * 100).toFixed(0).padStart(8) + "% | " + (diff > 0 ? "+" : "") + (diff * 100).toFixed(1).padStart(5) + "% | " + signal,
      );
    }
  }

  // --- 2. Event count distribution ---
  console.log("\n2. EVENT COUNT: How many events per trade?");
  const eventCounts = completed.map((t) => t.eventSequence.events.length);
  const wCounts = winners.map((t) => t.eventSequence.events.length);
  const lCounts = losers.map((t) => t.eventSequence.events.length);
  const avgCount = eventCounts.reduce((s, x) => s + x, 0) / eventCounts.length;
  const avgWCount = wCounts.length > 0 ? wCounts.reduce((s, x) => s + x, 0) / wCounts.length : 0;
  const avgLCount = lCounts.length > 0 ? lCounts.reduce((s, x) => s + x, 0) / lCounts.length : 0;
  console.log("   All trades:     " + avgCount.toFixed(1) + " events avg");
  console.log("   Winners:        " + avgWCount.toFixed(1) + " events avg");
  console.log("   Losers:         " + avgLCount.toFixed(1) + " events avg");

  // --- 3. Top event sequences (most common) ---
  console.log("\n3. TOP EVENT SEQUENCES: Most common narratives");
  console.log("   (Condensed: first letter of side + event type)\n");

  const seqMap = new Map<string, { count: number; wins: number; totalR: number; examples: Trade[] }>();
  for (const t of completed) {
    const condensed = t.eventSequence.events
      .slice(0, 8)
      .map((e) => {
        const s = e.side === "buy" ? "B" : e.side === "sell" ? "S" : "N";
        const abbrev = e.type.replace("IMPULSE_START", "IMP").replace("EXHAUSTION", "EXH").replace("REVERSAL", "REV")
          .replace("ABSORPTION", "ABS").replace("PULLBACK", "PBK").replace("ACCEPTANCE", "ACC")
          .replace("RATE_EXPANDS", "R+").replace("RATE_CONTRACTS", "R-");
        return s + "_" + abbrev;
      })
      .join(" > ");
    const existing = seqMap.get(condensed);
    if (existing) {
      existing.count++;
      if (t.r! > 0) existing.wins++;
      existing.totalR += t.r!;
      if (existing.examples.length < 2) existing.examples.push(t);
    } else {
      seqMap.set(condensed, { count: 1, wins: t.r! > 0 ? 1 : 0, totalR: t.r!, examples: [t] });
    }
  }

  const topSeqs = [...seqMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);

  console.log("   Seq  | Count | Win%  | Avg R  | Narrative");
  console.log("   -----|-------|-------|--------|----------");
  for (let i = 0; i < topSeqs.length; i++) {
    const [seq, s] = topSeqs[i];
    const winRate = s.count > 0 ? (s.wins / s.count * 100).toFixed(0) : "0";
    const avgR = s.count > 0 ? (s.totalR / s.count).toFixed(1) : "0";
    console.log(
      "   " + String(i + 1).padStart(3) + "  | " + String(s.count).padStart(5) + " | " + winRate.padStart(5) + " | " + avgR.padStart(6) + " | " + seq.slice(0, 60),
    );
  }

  // --- 4. Snapshot-matched pairs ---
  console.log("\n4. SNAPSHOT-MATCHED PAIRS: Similar entries, opposite outcomes");
  console.log("   Finding trades with similar distToPoc and CVD but R >= 10 vs R <= -1.\n");

  const bigWinners = completed.filter((t) => t.r! >= 10);
  const bigLosers = completed.filter((t) => t.r! <= -1);

  type MatchPair = { winner: Trade; loser: Trade; distDiff: number; cvdDiff: number };
  const pairs: MatchPair[] = [];

  for (const w of bigWinners) {
    let bestMatch: Trade | null = null;
    let bestDist = Infinity;
    for (const l of bigLosers) {
      const distDiff = Math.abs(w.entryContext.priceDistanceToPoc - l.entryContext.priceDistanceToPoc);
      const cvdW = w.entryContext.cvd?.cvd ?? 0;
      const cvdL = l.entryContext.cvd?.cvd ?? 0;
      const cvdDiff = Math.abs(cvdW - cvdL);
      const total = distDiff + cvdDiff * 2;
      if (total < bestDist) {
        bestDist = total;
        bestMatch = l;
      }
    }
    if (bestMatch && bestDist < 100) {
      pairs.push({
        winner: w,
        loser: bestMatch,
        distDiff: Math.abs(w.entryContext.priceDistanceToPoc - bestMatch.entryContext.priceDistanceToPoc),
        cvdDiff: Math.abs((w.entryContext.cvd?.cvd ?? 0) - (bestMatch.entryContext.cvd?.cvd ?? 0)),
      });
    }
  }

  console.log("   Found " + pairs.length + " matched pairs.\n");

  if (pairs.length > 0) {
    console.log("   Event frequency in matched pairs (winner vs loser):");
    console.log("   Event                | Winner | Loser  | Diff");
    console.log("   ---------------------|--------|--------|------");

    for (const evt of eventTypes) {
      for (const side of sides) {
        const wCount = pairs.filter((p) => p.winner.eventSequence.events.some((e) => e.type === evt && e.side === side)).length;
        const lCount = pairs.filter((p) => p.loser.eventSequence.events.some((e) => e.type === evt && e.side === side)).length;
        const wFreq = pairs.length > 0 ? wCount / pairs.length : 0;
        const lFreq = pairs.length > 0 ? lCount / pairs.length : 0;
        if (wFreq < 0.05 && lFreq < 0.05) continue;
        const label = (side !== "neutral" ? side[0] + "_" + evt.slice(0, 6) : evt.slice(0, 8));
        console.log(
          "   " + label.padEnd(21) + " | " + (wFreq * 100).toFixed(0).padStart(5) + "% | " + (lFreq * 100).toFixed(0).padStart(5) + "% | " + ((wFreq - lFreq) * 100).toFixed(0).padStart(4) + "%",
        );
      }
    }

    console.log("\n   Top matched pairs (winner sequence vs loser sequence):");
    for (let i = 0; i < Math.min(pairs.length, 5); i++) {
      const p = pairs[i];
      const fmt = (seq: MarketEvent[]) => seq.slice(0, 6).map((e) => {
        const s = e.side === "buy" ? "B" : e.side === "sell" ? "S" : "N";
        return s + "_" + e.type.replace("IMPULSE_START", "IMP").replace("EXHAUSTION", "EXH").replace("REVERSAL", "REV")
          .replace("ABSORPTION", "ABS").replace("PULLBACK", "PBK").replace("ACCEPTANCE", "ACC");
      }).join(" > ");
      console.log("   #" + String(i + 1) + " distDiff=" + p.distDiff.toFixed(0) + " cvdDiff=" + p.cvdDiff.toFixed(0));
      console.log("      WINNER (R=" + p.winner.r!.toFixed(1) + "): " + fmt(p.winner.eventSequence.events));
      console.log("      LOSER  (R=" + p.loser.r!.toFixed(1) + "): " + fmt(p.loser.eventSequence.events));
    }
  }

  // --- 5. Sequence length vs R ---
  console.log("\n5. SEQUENCE LENGTH vs R:");
  const seqBins: { label: string; trades: Trade[] }[] = [
    { label: "0-2 events", trades: completed.filter((t) => t.eventSequence.events.length <= 2) },
    { label: "3-5 events", trades: completed.filter((t) => t.eventSequence.events.length >= 3 && t.eventSequence.events.length <= 5) },
    { label: "6-8 events", trades: completed.filter((t) => t.eventSequence.events.length >= 6 && t.eventSequence.events.length <= 8) },
    { label: "9+ events", trades: completed.filter((t) => t.eventSequence.events.length >= 9) },
  ];

  console.log("   Bin          | Count | Win%  | Avg R  | Total R");
  console.log("   -------------|-------|-------|--------|--------");
  for (const b of seqBins) {
    if (b.trades.length === 0) continue;
    const w = b.trades.filter((t) => t.r! > 0).length;
    const avgR = b.trades.reduce((s, t) => s + t.r!, 0) / b.trades.length;
    const totalR = b.trades.reduce((s, t) => s + t.r!, 0);
    console.log(
      "   " + b.label.padEnd(12) + " | " + String(b.trades.length).padStart(5) + " | " + (w / b.trades.length * 100).toFixed(0).padStart(5) + " | " + avgR.toFixed(1).padStart(6) + " | " + totalR.toFixed(0).padStart(6),
    );
  }

  // --- 6. Last event before entry ---
  console.log("\n6. LAST EVENT BEFORE ENTRY: What happens right before the trade?");
  const lastEvents = new Map<string, { count: number; wins: number; totalR: number }>();
  for (const t of completed) {
    const events = t.eventSequence.events;
    if (events.length === 0) continue;
    const last = events[events.length - 1];
    const key = last.side !== "neutral" ? last.side[0] + "_" + last.type : last.type;
    const existing = lastEvents.get(key);
    if (existing) {
      existing.count++;
      if (t.r! > 0) existing.wins++;
      existing.totalR += t.r!;
    } else {
      lastEvents.set(key, { count: 1, wins: t.r! > 0 ? 1 : 0, totalR: t.r! });
    }
  }

  const sortedLast = [...lastEvents.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log("   Last Event       | Count | Win%  | Avg R");
  console.log("   -----------------|-------|-------|--------");
  for (const [evt, s] of sortedLast.slice(0, 10)) {
    const avgR = s.count > 0 ? (s.totalR / s.count).toFixed(1) : "0";
    console.log(
      "   " + evt.padEnd(17) + "| " + String(s.count).padStart(5) + " | " + (s.wins / s.count * 100).toFixed(0).padStart(5) + " | " + avgR.padStart(6),
    );
  }
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function analyzeDecileContrast(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null);
  if (completed.length < 20) { console.log("Not enough trades for decile analysis."); return; }

  const sorted = [...completed].sort((a, b) => a.r! - b.r!);
  const decileSize = Math.floor(sorted.length / 10);
  const p10 = sorted.slice(0, decileSize);
  const p90 = sorted.slice(sorted.length - decileSize);

  console.log("\n=== DECILE CONTRAST ANALYSIS ===");
  console.log(`Bottom decile (R <= ${p10[p10.length - 1]!.r!.toFixed(2)}): ${p10.length} trades`);
  console.log(`Top decile (R >= ${p90[0]!.r!.toFixed(2)}): ${p90.length} trades`);
  console.log(`Bottom decile avg R: ${mean(p10.map((t) => t.r!)).toFixed(2)}`);
  console.log(`Top decile avg R: ${mean(p90.map((t) => t.r!)).toFixed(2)}`);

  const featureResults: { feature: string; d: number; topMean: number; botMean: number; topMedian: number; botMedian: number; direction: string }[] = [];

  for (let fi = 0; fi < NUMERIC_LABELS.length; fi++) {
    const topVals = p90.map((t) => extractNumericFeatures(t)[fi]);
    const botVals = p10.map((t) => extractNumericFeatures(t)[fi]);
    const d = cohenD(topVals, botVals);
    const topM = mean(topVals);
    const botM = mean(botVals);
    featureResults.push({
      feature: NUMERIC_LABELS[fi],
      d: Math.abs(d),
      topMean: topM,
      botMean: botM,
      topMedian: median(topVals),
      botMedian: median(botVals),
      direction: d > 0 ? "higher in winners" : "higher in losers",
    });
  }

  featureResults.sort((a, b) => b.d - a.d);

  console.log("\nRanked by |Cohen's d| (d > 0.5 = meaningful):");
  console.log("  Feature             | |d|    | Top Mean | Bot Mean | Top Med  | Bot Med  | Direction");
  console.log("  --------------------|--------|----------|----------|----------|----------|----------");
  for (const f of featureResults) {
    console.log(
      `  ${f.feature.padEnd(20)}| ${f.d.toFixed(4).padStart(6)} | ${f.topMean.toFixed(2).padStart(8)} | ${f.botMean.toFixed(2).padStart(8)} | ${f.topMedian.toFixed(2).padStart(8)} | ${f.botMedian.toFixed(2).padStart(8)} | ${f.direction}`,
    );
  }
}

function analyzeDecisionTree(trades: Trade[]): void {
  const completed = trades.filter((t) => t.r !== null);
  if (completed.length < 50) { console.log("Not enough trades for decision tree."); return; }

  const features = completed.map((t) => extractNumericFeatures(t));
  const labels = completed.map((t) => (t.r! > 3 ? 1 : 0));
  const nFeatures = features[0].length;

  console.log("\n=== DECISION TREE RULE EXTRACTION ===");
  console.log(`Binary label: winner (R > 3) = ${labels.filter((l) => l === 1).length}, loser = ${labels.filter((l) => l === 0).length}`);
  console.log("Building greedy decision stumps...\n");

  type Stump = { featureIdx: number; threshold: number; leftLabel: number; rightLabel: number; leftAcc: number; rightAcc: number; leftN: number; rightN: number; gain: number };

  const stumps: Stump[] = [];

  for (let fi = 0; fi < nFeatures; fi++) {
    const vals = features.map((f) => f[fi]);
    const sortedVals = [...new Set(vals)].sort((a, b) => a - b);

    let bestGain = -1;
    let bestStump: Stump | null = null;

    for (let ti = 0; ti < sortedVals.length - 1; ti++) {
      const threshold = (sortedVals[ti] + sortedVals[ti + 1]) / 2;
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (let i = 0; i < features.length; i++) {
        if (features[i][fi] <= threshold) leftIdx.push(i);
        else rightIdx.push(i);
      }
      if (leftIdx.length < 10 || rightIdx.length < 10) continue;

      const leftLabels = leftIdx.map((i) => labels[i]);
      const rightLabels = rightIdx.map((i) => labels[i]);
      const leftPos = leftLabels.filter((l) => l === 1).length;
      const rightPos = rightLabels.filter((l) => l === 1).length;
      const leftLabel = leftPos > leftIdx.length / 2 ? 1 : 0;
      const rightLabel = rightPos > rightIdx.length / 2 ? 1 : 0;
      const leftAcc = leftLabel === 1 ? leftPos / leftIdx.length : (leftIdx.length - leftPos) / leftIdx.length;
      const rightAcc = rightLabel === 1 ? rightPos / rightIdx.length : (rightIdx.length - rightPos) / rightIdx.length;

      const parentPos = labels.filter((l) => l === 1).length / labels.length;
      const parentEntropy = -parentPos * Math.log2(parentPos + 1e-10) - (1 - parentPos) * Math.log2(1 - parentPos + 1e-10);
      const leftPosRate = leftPos / leftIdx.length;
      const rightPosRate = rightPos / rightIdx.length;
      const leftEnt = -leftPosRate * Math.log2(leftPosRate + 1e-10) - (1 - leftPosRate) * Math.log2(1 - leftPosRate + 1e-10);
      const rightEnt = -rightPosRate * Math.log2(rightPosRate + 1e-10) - (1 - rightPosRate) * Math.log2(1 - rightPosRate + 1e-10);
      const childEntropy = (leftIdx.length / features.length) * leftEnt + (rightIdx.length / features.length) * rightEnt;
      const gain = parentEntropy - childEntropy;

      if (gain > bestGain) {
        bestGain = gain;
        bestStump = {
          featureIdx: fi,
          threshold,
          leftLabel,
          rightLabel,
          leftAcc,
          rightAcc,
          leftN: leftIdx.length,
          rightN: rightIdx.length,
          gain,
        };
      }
    }
    if (bestStump) stumps.push(bestStump);
  }

  stumps.sort((a, b) => b.gain - a.gain);

  console.log("Top single-feature rules (greedy stumps):");
  console.log("  Rule                                                        | Acc    | N     | Gain");
  console.log("  ------------------------------------------------------------|--------|-------|------");
  for (const s of stumps.slice(0, 15)) {
    const fname = NUMERIC_LABELS[s.featureIdx] ?? `f${s.featureIdx}`;
    const leftRule = `IF ${fname} <= ${s.threshold.toFixed(4)} THEN ${s.leftLabel === 1 ? "WIN" : "LOSS"}`;
    const rightRule = `IF ${fname} > ${s.threshold.toFixed(4)} THEN ${s.rightLabel === 1 ? "WIN" : "LOSS"}`;
    const leftAcc = (s.leftAcc * 100).toFixed(0);
    const rightAcc = (s.rightAcc * 100).toFixed(0);
    console.log(`  ${leftRule.padEnd(60)}| ${leftAcc.padStart(4)}% | ${String(s.leftN).padStart(5)} | ${s.gain.toFixed(4)}`);
    console.log(`  ${rightRule.padEnd(60)}| ${rightAcc.padStart(4)}% | ${String(s.rightN).padStart(5)} |`);
  }

  console.log("\nTwo-feature combination rules:");
  const comboRules: { f1: number; t1: number; f2: number; t2: number; acc: number; n: number; gain: number }[] = [];

  for (let i = 0; i < Math.min(stumps.length, 8); i++) {
    for (let j = i + 1; j < Math.min(stumps.length, 8); j++) {
      const s1 = stumps[i];
      const s2 = stumps[j];
      if (s1.featureIdx === s2.featureIdx) continue;

      const matched: { label: number; pred: number }[] = [];
      for (let k = 0; k < features.length; k++) {
        const v1 = features[k][s1.featureIdx];
        const v2 = features[k][s2.featureIdx];
        const matchLeft1 = v1 <= s1.threshold;
        const matchRight1 = v1 > s1.threshold;
        const matchLeft2 = v2 <= s2.threshold;
        const matchRight2 = v2 > s2.threshold;

        let pred = -1;
        if (matchLeft1 && matchLeft2) pred = s1.leftLabel === s2.leftLabel ? s1.leftLabel : -1;
        else if (matchRight1 && matchRight2) pred = s1.rightLabel === s2.rightLabel ? s1.rightLabel : -1;
        else if (matchLeft1 && matchRight2) pred = s1.leftLabel === s2.rightLabel ? s1.leftLabel : -1;
        else if (matchRight1 && matchLeft2) pred = s1.rightLabel === s2.leftLabel ? s1.rightLabel : -1;

        if (pred >= 0) matched.push({ label: labels[k], pred });
      }

      if (matched.length < 20) continue;
      const correct = matched.filter((m) => m.label === m.pred).length;
      const acc = correct / matched.length;
      if (acc > 0.6) {
        comboRules.push({
          f1: s1.featureIdx, t1: s1.threshold,
          f2: s2.featureIdx, t2: s2.threshold,
          acc, n: matched.length,
          gain: s1.gain + s2.gain,
        });
      }
    }
  }

  comboRules.sort((a, b) => b.gain - a.gain);

  if (comboRules.length > 0) {
    for (const r of comboRules.slice(0, 10)) {
      const n1 = NUMERIC_LABELS[r.f1] ?? `f${r.f1}`;
      const n2 = NUMERIC_LABELS[r.f2] ?? `f${r.f2}`;
      console.log(`  IF ${n1} <= ${r.t1.toFixed(4)} AND ${n2} <= ${r.t2.toFixed(4)} THEN ... (${(r.acc * 100).toFixed(0)}%, n=${r.n})`);
    }
  } else {
    console.log("  No strong two-feature combinations found.");
  }
}
