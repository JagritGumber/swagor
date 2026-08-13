import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import type { ReaderHistoryAuctionConfig, ReaderHistoryInput, ReaderHistoryStep } from "./types";

const DEFAULT_CACHE_DIR = ".data/history-cache";

export type HistoryCacheKey = string;

export function historyCacheKeyFor(input: {
  asset: string;
  interval: string;
  candleIntervalMs: number;
  readIntervalMs: number;
  orderflowWindowMs?: number;
  startAt?: number;
  endAt?: number;
  auctionConfig?: ReaderHistoryAuctionConfig;
}): HistoryCacheKey {
  const parts = [
    input.asset.toUpperCase(),
    input.interval,
    `candle=${input.candleIntervalMs}`,
    `read=${input.readIntervalMs}`,
    `oflow=${input.orderflowWindowMs ?? 60_000}`,
    `start=${input.startAt ?? "auto"}`,
    `end=${input.endAt ?? "auto"}`,
  ];
  if (input.auctionConfig) {
    const ac = input.auctionConfig;
    if (ac.swingLeft !== undefined) parts.push(`sl=${ac.swingLeft}`);
    if (ac.swingRight !== undefined) parts.push(`sr=${ac.swingRight}`);
    if (ac.levelCandles !== undefined) parts.push(`lc=${ac.levelCandles}`);
    if (ac.levelTolerancePct !== undefined) parts.push(`lt=${ac.levelTolerancePct}`);
    if (ac.levelMinTouches !== undefined) parts.push(`lm=${ac.levelMinTouches}`);
    if (ac.maxLevelDistancePct !== undefined) parts.push(`md=${ac.maxLevelDistancePct}`);
    if (ac.profileCandles !== undefined) parts.push(`pc=${ac.profileCandles}`);
    if (ac.profileRadiusPct !== undefined) parts.push(`pr=${ac.profileRadiusPct}`);
    if (ac.profileBins !== undefined) parts.push(`pb=${ac.profileBins}`);
    if (ac.profileTradeWindowMs !== undefined) parts.push(`ptw=${ac.profileTradeWindowMs}`);
    if (ac.profileTradeSampleLimit !== undefined) parts.push(`psl=${ac.profileTradeSampleLimit}`);
    if (ac.localRangeCandles !== undefined) parts.push(`lrc=${ac.localRangeCandles}`);
  }
  return parts.join("_");
}

export function loadHistoryCache(key: HistoryCacheKey, cacheDir?: string): ReaderHistoryStep[] | null {
  const dir = cacheDir ?? DEFAULT_CACHE_DIR;
  const gzPath = join(dir, `${key}.json.gz`);
  const jsonPath = join(dir, `${key}.json`);
  try {
    if (existsSync(gzPath)) {
      const buf = readFileSync(gzPath);
      const json = gunzipSync(buf).toString("utf-8");
      return JSON.parse(json) as ReaderHistoryStep[];
    }
    if (existsSync(jsonPath)) {
      const raw = readFileSync(jsonPath, "utf-8");
      return JSON.parse(raw) as ReaderHistoryStep[];
    }
    return null;
  } catch {
    return null;
  }
}

export function saveHistoryCache(steps: ReaderHistoryStep[], key: HistoryCacheKey, cacheDir?: string): void {
  const dir = cacheDir ?? DEFAULT_CACHE_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const json = JSON.stringify(steps);
  const gz = gzipSync(Buffer.from(json), { level: 6 });
  writeFileSync(join(dir, `${key}.json.gz`), gz);
}

export function buildOrLoadHistorySteps(
  input: ReaderHistoryInput,
  buildFn: (input: ReaderHistoryInput) => ReaderHistoryStep[],
  options?: { cacheDir?: string; skipCache?: boolean },
): { steps: ReaderHistoryStep[]; fromCache: boolean } {
  const key = historyCacheKeyFor({
    asset: input.asset,
    interval: input.interval,
    candleIntervalMs: input.candleIntervalMs,
    readIntervalMs: input.readIntervalMs,
    orderflowWindowMs: input.orderflowWindowMs,
    startAt: input.startAt,
    endAt: input.endAt,
    auctionConfig: input.auctionConfig,
  });

  if (!options?.skipCache) {
    const cached = loadHistoryCache(key, options?.cacheDir);
    if (cached) {
      return { steps: cached, fromCache: true };
    }
  }

  const steps = buildFn(input);
  saveHistoryCache(steps, key, options?.cacheDir);
  return { steps, fromCache: false };
}
