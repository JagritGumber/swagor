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
        }
      } else {
        const signal = evaluateSignal(currentPrice, currentReadMs, structure, cvd, read, input.config);
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

function evaluateSignal(
  price: number,
  nowMs: number,
  structure: VolumeProfileStructure,
  cvd: CvdRead | null,
  read: MarketStructureRead,
  config: BacktestConfig,
): Trade | null {
  if (read.action === "rotating") return null;
  if (read.location === "at-poc") return null;
  if (config.noRejecting && read.action === "rejecting") return null;
  if (config.discoveringOnly && read.action !== "discovering") return null;
  if (config.bullishDiv && (!cvd || cvd.priceCvdDivergence !== "bullish")) return null;

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
