import { loadMarketStoreManifest, writeBybitOrderflowMonth } from "../packages/market-data";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const symbols = parseSymbols(arg("symbols", "BTCUSDT"));
const startMonth = parseMonth(arg("start-month"));
const endMonth = parseMonth(arg("end-month"));
const rawRoot = arg("raw-root", "raw-data/bybit/trading")!;
const storeRoot = arg("store-root", "market-store")!;
const profileBinSize = Number(arg("profile-bin-size", "1"));
const downloadMissing = hasFlag("download-missing");
const force = hasFlag("force");

if (startMonth > endMonth) throw new Error("--end-month must be on or after --start-month");
if (!Number.isFinite(profileBinSize) || profileBinSize <= 0) throw new Error("--profile-bin-size must be positive");

console.log("BYBIT PARQUET RANGE IMPORT");
console.log(`symbols=${symbols.join(",")} months=${startMonth}..${endMonth} rawRoot=${rawRoot} storeRoot=${storeRoot} downloadMissing=${downloadMissing} force=${force}`);

for (const symbol of symbols) {
  for (const month of monthRange(startMonth, endMonth)) {
    const existing = force ? null : await existingMonth(symbol, month);
    if (existing) {
      console.log(`${symbol} ${month} status=cached bucket_rows=${existing.buckets1s?.rowCount ?? 0} profile_rows=${existing.profiles5m?.rowCount ?? 0}`);
      continue;
    }
    const result = await writeBybitOrderflowMonth({
      rawRoot,
      storeRoot,
      symbol,
      month,
      dates: dateRangeForMonth(month),
      profileBinSize,
      downloadMissing,
      onDate: (progress) => {
        console.log(`${progress.symbol} ${progress.date} status=${progress.status} trades=${progress.trades} bucket_rows=${progress.bucketRows} profile_rows=${progress.profileRows}`);
      },
    });
    console.log(`${result.symbol} ${result.month} status=imported trades=${result.trades} bucket_rows=${result.bucketRows} profile_rows=${result.profileRows} missing_dates=${result.missingDates.length}`);
    if (result.missingDates.length > 0) console.log(`  missing=${result.missingDates.join(",")}`);
  }
}

async function existingMonth(symbol: string, month: string) {
  try {
    const manifest = await loadMarketStoreManifest({
      rootDir: storeRoot,
      venue: "bybit",
      market: "trading",
      symbol,
    });
    return manifest.months[month] ?? null;
  } catch (error: unknown) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

function parseSymbols(value: string | undefined): string[] {
  const parsed = (value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (parsed.length === 0) throw new Error("--symbols must include at least one symbol");
  return parsed;
}

function parseMonth(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) throw new Error("--start-month and --end-month must use YYYY-MM");
  const parsed = Date.parse(`${value}-01T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) throw new Error(`invalid month ${value}`);
  return value;
}

function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${start}-01T00:00:00.000Z`);
  const last = new Date(`${end}-01T00:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function dateRangeForMonth(month: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${month}-01T00:00:00.000Z`);
  while (cursor.toISOString().slice(0, 7) === month) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}

