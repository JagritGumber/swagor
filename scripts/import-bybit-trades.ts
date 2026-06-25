import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bybitTradeToOrderflowEvent, bybitTradeUrl, parseBybitTradeCsv } from "../packages/market-data";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const symbols = parseSymbols(arg("symbols", "BTCUSDT"));
const startDate = parseDate(arg("start"));
const endDate = parseDate(arg("end"));
const rawRoot = arg("raw-root", "raw-data/bybit/trading")!;
const outRoot = arg("out", "orderflow-data")!;
const dryRun = hasFlag("dry-run");
const force = hasFlag("force");

if (startDate.getTime() > endDate.getTime()) throw new Error("--end must be on or after --start");

const results: ImportResult[] = [];
for (const symbol of symbols) {
  for (const date of dateRange(startDate, endDate)) {
    results.push(await importDay({ symbol, date }));
  }
}

printResults(results);

type ImportResult = {
  symbol: string;
  date: string;
  status: "dry-run" | "imported" | "cached" | "missing" | "failed";
  url: string;
  rawPath: string;
  outPath: string;
  trades: number;
  firstTradeAt: number | null;
  lastTradeAt: number | null;
  error?: string;
};

type BinaryArchive = Uint8Array<ArrayBuffer>;

async function importDay(input: {
  symbol: string;
  date: string;
}): Promise<ImportResult> {
  const url = bybitTradeUrl({ symbol: input.symbol, date: input.date, market: "trading" });
  const rawPath = join(rawRoot, input.symbol, `${input.date}.csv.gz`);
  const outPath = join(outRoot, "bybit", "trading", input.symbol, `${input.date}.ndjson`);
  if (dryRun) {
    return { symbol: input.symbol, date: input.date, status: "dry-run", url, rawPath, outPath, trades: 0, firstTradeAt: null, lastTradeAt: null };
  }

  try {
    const compressed = force ? await download(url, rawPath) : await downloadIfMissing(url, rawPath);
    const csv = gunzipSync(compressed).toString("utf8");
    const trades = parseBybitTradeCsv({ text: csv, symbol: input.symbol });
    if (trades.length === 0) {
      return { symbol: input.symbol, date: input.date, status: "failed", url, rawPath, outPath, trades: 0, firstTradeAt: null, lastTradeAt: null, error: "parsed zero trades" };
    }
    const events = trades.map(bybitTradeToOrderflowEvent);
    const ndjson = events.map((event) => `${JSON.stringify(event)}\n`).join("");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, ndjson, "utf8");
    return {
      symbol: input.symbol,
      date: input.date,
      status: "imported",
      url,
      rawPath,
      outPath,
      trades: trades.length,
      firstTradeAt: trades[0]?.time ?? null,
      lastTradeAt: trades[trades.length - 1]?.time ?? null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = message.includes("404") || message.includes("403");
    return { symbol: input.symbol, date: input.date, status: missing ? "missing" : "failed", url, rawPath, outPath, trades: 0, firstTradeAt: null, lastTradeAt: null, error: message };
  }
}

async function downloadIfMissing(url: string, rawPath: string): Promise<BinaryArchive> {
  try {
    const existing = await readFile(rawPath);
    if (existing.length > 0) return new Uint8Array(existing);
  } catch {
    // Download below.
  }
  return download(url, rawPath);
}

async function download(url: string, rawPath: string): Promise<BinaryArchive> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "agoratest-orderflow-importer/1.0",
    },
  });
  if (!response.ok) throw new Error(`download failed ${response.status} ${response.statusText}`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error("downloaded empty file");
  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, buffer);
  return buffer;
}

function printResults(results: ImportResult[]): void {
  console.log("BYBIT TRADE IMPORT");
  console.log(`symbols=${symbols.join(",")} start=${dateString(startDate)} end=${dateString(endDate)} dryRun=${dryRun}`);
  for (const result of results) {
    const range = result.firstTradeAt && result.lastTradeAt ? `${iso(result.firstTradeAt)} -> ${iso(result.lastTradeAt)}` : "n/a";
    console.log(`${result.symbol} ${result.date} status=${result.status} trades=${result.trades} range=${range}`);
    if (result.status === "dry-run") console.log(`  url=${result.url}`);
    if (result.error) console.log(`  error=${result.error}`);
  }
  const imported = results.filter((result) => result.status === "imported").length;
  const missing = results.filter((result) => result.status === "missing").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const trades = results.reduce((sum, result) => sum + result.trades, 0);
  console.log(`SUMMARY imported_days=${imported} missing_days=${missing} failed_days=${failed} trades=${trades}`);
}

function parseSymbols(value: string | undefined): string[] {
  const parsed = (value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (parsed.length === 0) throw new Error("--symbols must include at least one symbol");
  return parsed;
}

function parseDate(value: string | undefined): Date {
  if (!value) throw new Error("--start and --end are required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("dates must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`invalid date ${value}`);
  return parsed;
}

function dateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function iso(time: number): string {
  return new Date(time).toISOString();
}


