import { writeBybitOrderflowMonth } from "../packages/market-data";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const symbols = parseSymbols(arg("symbols", "BTCUSDT"));
const month = parseMonth(arg("month"));
const start = parseDate(arg("start", `${month}-01`));
const end = parseDate(arg("end", lastDayOfMonth(month)));
const rawRoot = arg("raw-root", "raw-data/bybit/trading")!;
const storeRoot = arg("store-root", "market-store")!;
const profileBinSize = Number(arg("profile-bin-size", "1"));
const downloadMissing = hasFlag("download-missing");

if (start.getTime() > end.getTime()) throw new Error("--end must be on or after --start");
if (!Number.isFinite(profileBinSize) || profileBinSize <= 0) throw new Error("--profile-bin-size must be positive");

console.log("BYBIT PARQUET IMPORT");
console.log(`symbols=${symbols.join(",")} month=${month} start=${dateString(start)} end=${dateString(end)} rawRoot=${rawRoot} storeRoot=${storeRoot} downloadMissing=${downloadMissing}`);

for (const symbol of symbols) {
  const result = await writeBybitOrderflowMonth({
    rawRoot,
    storeRoot,
    symbol,
    month,
    dates: dateRange(start, end),
    profileBinSize,
    downloadMissing,
    onDate: (progress) => {
      console.log(`${progress.symbol} ${progress.date} status=${progress.status} trades=${progress.trades} bucket_rows=${progress.bucketRows} profile_rows=${progress.profileRows}`);
    },
  });
  console.log(`${result.symbol} ${result.month} trades=${result.trades} bucket_rows=${result.bucketRows} profile_rows=${result.profileRows}`);
  console.log(`  buckets=${result.bucketsPath}`);
  console.log(`  profiles=${result.profilesPath}`);
  console.log(`  source_dates=${result.sourceDates.length} missing_dates=${result.missingDates.length}`);
  if (result.missingDates.length > 0) console.log(`  missing=${result.missingDates.join(",")}`);
}

function parseSymbols(value: string | undefined): string[] {
  const parsed = (value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (parsed.length === 0) throw new Error("--symbols must include at least one symbol");
  return parsed;
}

function parseMonth(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) throw new Error("--month must use YYYY-MM");
  const parsed = Date.parse(`${value}-01T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) throw new Error(`invalid month ${value}`);
  return value;
}

function parseDate(value: string | undefined): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("dates must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`invalid date ${value}`);
  if (dateString(parsed).slice(0, 7) !== month) throw new Error("--start/--end must be inside --month");
  return parsed;
}

function dateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  for (let cursor = startDate.getTime(); cursor <= endDate.getTime(); cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

function lastDayOfMonth(value: string): string {
  const [year, monthText] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, monthText!, 0)).toISOString().slice(0, 10);
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
