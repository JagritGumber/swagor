import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

declare const Bun: {
  spawn(input: {
    cmd: string[];
    stdout: "pipe";
    stderr: "pipe";
  }): {
    stdout: ReadableStream;
    stderr: ReadableStream;
    exited: Promise<number>;
  };
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const symbol = arg("symbol", "BTCUSDT")!.toUpperCase();
const startMonth = parseMonth(arg("start-month"));
const endMonth = parseMonth(arg("end-month"));
const mode = arg("mode", "rolling")!;
const marketStoreRoot = arg("market-store-root", "market-store")!;
const bucketEventMode = arg("bucket-event-mode", "aggregate")!;
const auctionLevelCandles = optionalPositiveInteger(arg("auction-level-candles"), "--auction-level-candles");
const profileTradeSampleLimit = optionalPositiveInteger(arg("profile-trade-sample-limit"), "--profile-trade-sample-limit");
const readerRadar = arg("reader-radar", "execute");
const readerRadarMaxStaleMs = optionalPositiveInteger(arg("reader-radar-max-stale-ms"), "--reader-radar-max-stale-ms");
const tradeStyle = arg("trade-style");
const outDir = arg("out-dir", join("docs", "strategy-lab", "radar-updates"))!;
const tradeTapeDir = arg("trade-tape-dir");
const profileOut = arg("profile-out");
const riskPct = arg("risk-pct");
const feePct = arg("fee-pct");
const slippagePct = arg("slippage-pct");
const chunkDays = hasFlag("chunk-days") || !hasFlag("chunk-months");
const force = hasFlag("force");

await mkdir(outDir, { recursive: true });
const months = monthRange(startMonth, endMonth);
const updatePaths: string[] = [];

for (const month of months) {
  const updatePath = join(outDir, `${symbol.toLowerCase()}-${mode}-${month}.json`);
  if (!force && await hasValidUpdates(updatePath, month)) {
    console.log(`SKIP radar-updates month=${month} out=${updatePath}`);
    updatePaths.push(updatePath);
    continue;
  }
  console.log(`RUN radar-updates month=${month} out=${updatePath}`);
  await runEvaluator({ month, updatePath });
  updatePaths.push(updatePath);
}

if (profileOut) await runPromotionProfile(updatePaths);
process.exit(0);

async function hasValidUpdates(path: string, month: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      run?: {
        startAt?: string;
        endAt?: string;
        venue?: string;
        dataMode?: string;
        bucketEventMode?: string;
        narrativeSessionMode?: string;
        readerRadar?: string;
        readerRadarMaxStaleMs?: number;
        tradeStyle?: string;
        chunking?: string;
      };
      assets?: unknown[];
    };
    return parsed.run?.startAt === `${month}-01T00:00:00.000Z`
      && parsed.run?.endAt === `${nextMonthStart(month)}T00:00:00.000Z`
      && parsed.run?.venue === "bybit"
      && parsed.run?.dataMode === "parquet"
      && parsed.run?.bucketEventMode === bucketEventMode
      && parsed.run?.narrativeSessionMode === mode
      && parsed.run?.readerRadar === readerRadar
      && parsed.run?.readerRadarMaxStaleMs === readerRadarMaxStaleMs
      && parsed.run?.tradeStyle === tradeStyle
      && parsed.run?.chunking === chunkingMode()
      && Array.isArray(parsed.assets);
  } catch (error: unknown) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

async function runEvaluator(input: {
  month: string;
  updatePath: string;
}): Promise<void> {
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "--conditions",
      "react-server",
      "scripts/evaluate-orderflow-poc.ts",
      "--venue",
      "bybit",
      "--assets",
      symbol,
      "--start",
      `${input.month}-01`,
      "--end",
      nextMonthStart(input.month),
      "--data-mode",
      "parquet",
      "--market-store-root",
      marketStoreRoot,
      "--bucket-event-mode",
      bucketEventMode,
      "--narrative-session-mode",
      mode,
      ...(auctionLevelCandles === undefined ? [] : ["--auction-level-candles", String(auctionLevelCandles)]),
      ...(profileTradeSampleLimit === undefined ? [] : ["--profile-trade-sample-limit", String(profileTradeSampleLimit)]),
      ...(readerRadar === undefined ? [] : ["--reader-radar", readerRadar]),
      ...(readerRadarMaxStaleMs === undefined ? [] : ["--reader-radar-max-stale-ms", String(readerRadarMaxStaleMs)]),
      ...(tradeStyle === undefined ? [] : ["--trade-style", tradeStyle]),
      "--summary-only",
      chunkDays ? "--chunk-days" : "--chunk-months",
      "--radar-updates-out",
      input.updatePath,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) throw new Error(`radar update evaluation failed month=${input.month}: ${stderr || stdout}`);
  const promoted = stdout.match(/radar_promoted=(\d+)/);
  console.log(promoted ? `DONE ${input.month} promoted=${promoted[1]}` : `DONE ${input.month}`);
}

async function runPromotionProfile(updatePaths: string[]): Promise<void> {
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "--conditions",
      "react-server",
      "scripts/profile-reader-radar-promotions.ts",
      "--updates",
      updatePaths.join(","),
      ...(tradeTapeDir === undefined ? [] : ["--trade-tape-dir", tradeTapeDir]),
      ...(riskPct === undefined ? [] : ["--risk-pct", riskPct]),
      ...(feePct === undefined ? [] : ["--fee-pct", feePct]),
      ...(slippagePct === undefined ? [] : ["--slippage-pct", slippagePct]),
      "--out",
      profileOut!,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) throw new Error(`radar promotion profile failed: ${stderr || stdout}`);
  console.log(stdout.trim());
}

function parseMonth(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) throw new Error("month must be YYYY-MM");
  return value;
}

function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${start}-01T00:00:00.000Z`);
  const last = new Date(`${end}-01T00:00:00.000Z`);
  while (cursor <= last) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function nextMonthStart(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function chunkingMode(): string {
  return chunkDays ? "days" : "months";
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}


