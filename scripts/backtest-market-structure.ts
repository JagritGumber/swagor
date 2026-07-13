import { readOrderflowBuckets, readVolumeProfileBuckets } from "../packages/market-data";
import { parseVolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import { calculateCvd } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import type { VolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import type { CvdRead } from "../packages/strategy-lab/read-core/orderflow/calculate-cvd";
import type { OrderflowBucket, VolumeProfileBucket } from "../packages/market-data/parquet/types";

type TradeSide = "long" | "short";

type Trade = {
  side: TradeSide;
  entryPrice: number;
  entryAt: number;
  stop: number;
  target: number;
  exitPrice: number | null;
  exitAt: number | null;
  r: number | null;
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  console.log(`Market Structure Backtest: ${start} to ${end}`);
  console.log(`Read interval: ${readIntervalMs / 1000}s, Orderflow window: ${orderflowWindowMs / 1000}s`);
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
  });

  printResult(result);
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

function bisectRight(arr: OrderflowBucket[], targetMs: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].bucketMs <= targetMs) lo = mid + 1;
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
}): BacktestResult {
  const trades: Trade[] = [];
  let openTrade: Trade | null = null;
  let structure: VolumeProfileStructure | null = null;

  let currentReadMs = input.startMs;
  while (currentReadMs <= input.endMs) {
    const prevWindowKey = windowKey(currentReadMs - 300000, 300000);
    const closedProfiles = input.profilesByWindow.get(prevWindowKey) ?? [];
    if (closedProfiles.length > 0) {
      structure = parseVolumeProfileStructure({ buckets: closedProfiles });
    }

    const ofStart = currentReadMs - input.orderflowWindowMs;
    const ofEnd = currentReadMs;
    const lo = bisectLeft(input.orderflowBuckets, ofStart);
    const hi = bisectRight(input.orderflowBuckets, ofEnd);
    const windowOrderflow = input.orderflowBuckets.slice(lo, hi);
    const cvd = calculateCvd(windowOrderflow);

    const lastBucket = windowOrderflow[windowOrderflow.length - 1];
    const currentPrice = lastBucket?.close ?? null;

    if (currentPrice !== null && structure !== null) {
      if (openTrade) {
        openTrade = updateTrade(openTrade, currentPrice, currentReadMs, structure, cvd);
        if (openTrade.exitPrice !== null) {
          trades.push(openTrade);
          openTrade = null;
        }
      } else {
        const signal = evaluateSignal(currentPrice, currentReadMs, structure, cvd);
        if (signal) {
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
): Trade | null {
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
        return {
          side: "long",
          entryPrice: price,
          entryAt: nowMs,
          stop,
          target,
          exitPrice: null,
          exitAt: null,
          r: null,
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
): Trade {
  const risk = Math.abs(trade.entryPrice - trade.stop);

  if (trade.side === "long") {
    if (currentPrice <= trade.stop) {
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
    }
    if (currentPrice >= trade.target) {
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.target - trade.entryPrice) / risk };
    }
  } else {
    if (currentPrice >= trade.stop) {
      return { ...trade, exitPrice: trade.stop, exitAt: nowMs, r: -1 };
    }
    if (currentPrice <= trade.target) {
      return { ...trade, exitPrice: trade.target, exitAt: nowMs, r: (trade.entryPrice - trade.target) / risk };
    }
  }

  return trade;
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
  };
}

function printResult(result: BacktestResult): void {
  console.log("\n=== BACKTEST RESULTS ===");
  console.log(`Total trades: ${result.totalTrades}`);
  console.log(`Wins: ${result.wins}, Losses: ${result.losses}`);
  console.log(`Win rate: ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`Total R: ${result.totalR.toFixed(4)}`);
  console.log(`Average R: ${result.averageR.toFixed(4)}`);
  console.log(`Max drawdown: ${result.maxDrawdownR.toFixed(4)}R`);

  if (result.trades.length > 0) {
    console.log("\n=== TRADE LIST (first 20) ===");
    for (const t of result.trades.slice(0, 20)) {
      const r = t.r !== null ? t.r.toFixed(2) : "open";
      const exitReason = t.exitPrice === t.stop ? "STOP" : t.exitPrice === t.target ? "TARGET" : "EXIT";
      console.log(
        `  ${t.side.toUpperCase()} @ ${t.entryPrice.toFixed(2)} -> ${t.exitPrice?.toFixed(2) ?? "?"} [${exitReason}] R=${r}`,
      );
    }
  }

  const target = 0.2;
  console.log(`\n=== COMPARISON ===`);
  console.log(`Baseline: 0.09 R/trade`);
  console.log(`Target: >${target} R/trade`);
  console.log(`Result: ${result.averageR.toFixed(4)} R/trade`);
  console.log(result.averageR >= target ? "TARGET MET" : "TARGET NOT MET");
}
