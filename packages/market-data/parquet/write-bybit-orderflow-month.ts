import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { aggregateOrderflowBuckets } from "./aggregate-orderflow-buckets";
import { aggregateVolumeProfileBuckets } from "./aggregate-volume-profile-buckets";
import { loadMarketStoreManifest } from "./load-market-store-manifest";
import { marketStoreMonthFileName, marketStoreSymbolDir } from "./market-store-paths";
import { saveMarketStoreManifest } from "./save-market-store-manifest";
import { writeOrderflowBucketsParquet } from "./write-orderflow-buckets-parquet";
import { writeVolumeProfileBucketsParquet } from "./write-volume-profile-buckets-parquet";
import { bybitTradeUrl } from "../bybit/bybit-trade-url";
import { parseBybitTradeCsv } from "../bybit/parse-bybit-trade-csv";
import type { MarketStoreManifest, OrderflowBucket, VolumeProfileBucket } from "./types";

export type WriteBybitOrderflowMonthResult = {
  symbol: string;
  month: string;
  sourceDates: string[];
  missingDates: string[];
  trades: number;
  bucketRows: number;
  profileRows: number;
  bucketsPath: string;
  profilesPath: string;
};

export type WriteBybitOrderflowMonthDateProgress = {
  symbol: string;
  date: string;
  status: "missing" | "parsed";
  trades: number;
  bucketRows: number;
  profileRows: number;
};

type BinaryArchive = Uint8Array<ArrayBuffer>;

export async function writeBybitOrderflowMonth(input: {
  rawRoot: string;
  storeRoot: string;
  symbol: string;
  month: string;
  dates: string[];
  profileBinSize: number;
  downloadMissing?: boolean;
  onDate?: (progress: WriteBybitOrderflowMonthDateProgress) => void;
}): Promise<WriteBybitOrderflowMonthResult> {
  const symbol = input.symbol.toUpperCase();
  const orderflowBuckets = new Map<number, OrderflowBucket>();
  const profileBuckets = new Map<string, VolumeProfileBucket>();
  const sourceDates: string[] = [];
  const missingDates: string[] = [];
  let trades = 0;

  for (const date of input.dates) {
    const rawPath = join(input.rawRoot, symbol, `${date}.csv.gz`);
    const compressed = await readRawArchive({ rawPath, symbol, date, downloadMissing: input.downloadMissing });
    if (!compressed) {
      missingDates.push(date);
      input.onDate?.({ symbol, date, status: "missing", trades: 0, bucketRows: 0, profileRows: 0 });
      continue;
    }
    const csv = gunzipSync(compressed).toString("utf8");
    const rows = parseBybitTradeCsv({ text: csv, symbol });
    if (rows.length === 0) {
      input.onDate?.({ symbol, date, status: "parsed", trades: 0, bucketRows: 0, profileRows: 0 });
      continue;
    }
    const dayBuckets = aggregateOrderflowBuckets({ trades: rows });
    const dayProfiles = aggregateVolumeProfileBuckets({ trades: rows, priceBinSize: input.profileBinSize });
    sourceDates.push(date);
    trades += rows.length;
    mergeOrderflowBuckets(orderflowBuckets, dayBuckets);
    mergeVolumeProfileBuckets(profileBuckets, dayProfiles);
    input.onDate?.({
      symbol,
      date,
      status: "parsed",
      trades: rows.length,
      bucketRows: dayBuckets.length,
      profileRows: dayProfiles.length,
    });
  }

  if (sourceDates.length === 0) throw new Error(`no Bybit raw archives found for ${symbol} ${input.month}`);

  const bucketRows = [...orderflowBuckets.values()].sort((left, right) => left.bucketMs - right.bucketMs);
  const profileRows = [...profileBuckets.values()].sort((left, right) => left.startMs - right.startMs || left.binLow - right.binLow);
  const symbolDir = marketStoreSymbolDir({ rootDir: input.storeRoot, venue: "bybit", market: "trading", symbol });
  const bucketsName = marketStoreMonthFileName("buckets-1s", input.month);
  const profilesName = marketStoreMonthFileName("profiles-5m", input.month);
  const bucketsPath = join(symbolDir, bucketsName);
  const profilesPath = join(symbolDir, profilesName);

  await writeOrderflowBucketsParquet({ path: bucketsPath, rows: bucketRows });
  await writeVolumeProfileBucketsParquet({ path: profilesPath, rows: profileRows });

  const manifest = await loadOrCreateManifest({ storeRoot: input.storeRoot, symbol });
  manifest.months[input.month] = {
    buckets1s: {
      path: bucketsName,
      startMs: bucketRows[0]!.bucketMs,
      endMs: bucketRows[bucketRows.length - 1]!.bucketMs,
      rowCount: bucketRows.length,
      schemaVersion: 1,
    },
    profiles5m: {
      path: profilesName,
      startMs: profileRows[0]?.startMs ?? bucketRows[0]!.bucketMs,
      endMs: profileRows[profileRows.length - 1]?.endMs ?? bucketRows[bucketRows.length - 1]!.bucketMs,
      rowCount: profileRows.length,
      schemaVersion: 1,
    },
    sourceRawDates: sourceDates,
    createdAt: new Date().toISOString(),
  };
  await saveMarketStoreManifest({ rootDir: input.storeRoot, manifest });

  return {
    symbol,
    month: input.month,
    sourceDates,
    missingDates,
    trades,
    bucketRows: bucketRows.length,
    profileRows: profileRows.length,
    bucketsPath,
    profilesPath,
  };
}

async function readRawArchive(input: {
  rawPath: string;
  symbol: string;
  date: string;
  downloadMissing?: boolean;
}): Promise<BinaryArchive | null> {
  try {
    const existing = await readFile(input.rawPath);
    return new Uint8Array(existing);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) throw error;
    if (!input.downloadMissing) return null;
  }

  const url = bybitTradeUrl({ symbol: input.symbol, date: input.date, market: "trading" });
  const response = await fetch(url, { headers: { "user-agent": "agoratest-market-store/1.0" } });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) return null;
    throw new Error(`download failed ${response.status} ${response.statusText}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error(`downloaded empty Bybit archive for ${input.symbol} ${input.date}`);
  await mkdir(dirname(input.rawPath), { recursive: true });
  await writeFile(input.rawPath, buffer);
  return buffer;
}

function mergeOrderflowBuckets(target: Map<number, OrderflowBucket>, rows: OrderflowBucket[]): void {
  for (const row of rows) {
    const existing = target.get(row.bucketMs);
    if (!existing) {
      target.set(row.bucketMs, { ...row });
      continue;
    }
    existing.high = Math.max(existing.high, row.high);
    existing.low = Math.min(existing.low, row.low);
    existing.close = row.close;
    existing.buyVolume += row.buyVolume;
    existing.sellVolume += row.sellVolume;
    existing.delta += row.delta;
    existing.tradeCount += row.tradeCount;
    existing.lastTradePrice = row.lastTradePrice;
    if (row.largestTradeSize > existing.largestTradeSize) {
      existing.largestTradeSize = row.largestTradeSize;
      existing.largestTradePrice = row.largestTradePrice;
      existing.largestTradeSide = row.largestTradeSide;
    }
  }
}

function mergeVolumeProfileBuckets(target: Map<string, VolumeProfileBucket>, rows: VolumeProfileBucket[]): void {
  for (const row of rows) {
    const key = `${row.startMs}:${row.binLow}`;
    const existing = target.get(key);
    if (existing) {
      existing.volume += row.volume;
      continue;
    }
    target.set(key, { ...row });
  }
}

async function loadOrCreateManifest(input: {
  storeRoot: string;
  symbol: string;
}): Promise<MarketStoreManifest> {
  try {
    return await loadMarketStoreManifest({
      rootDir: input.storeRoot,
      venue: "bybit",
      market: "trading",
      symbol: input.symbol,
    });
  } catch (error: unknown) {
    if (!isMissingFileError(error)) throw error;
    return {
      venue: "bybit",
      market: "trading",
      symbol: input.symbol,
      schemaVersion: 1,
      months: {},
    };
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}
