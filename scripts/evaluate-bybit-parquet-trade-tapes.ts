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
const outDir = arg("out-dir", join("docs", "strategy-lab", "trade-tapes"))!;
const learnerOut = arg("learner-out");
const chunkDays = hasFlag("chunk-days") || !hasFlag("chunk-months");
const force = hasFlag("force");

await mkdir(outDir, { recursive: true });
const months = monthRange(startMonth, endMonth);
const tapePaths: string[] = [];

for (const month of months) {
  const tapePath = join(outDir, `${symbol.toLowerCase()}-${mode}-${month}.json`);
  if (!force && await hasValidTape(tapePath, month)) {
    console.log(`SKIP tape month=${month} out=${tapePath}`);
    tapePaths.push(tapePath);
    continue;
  }
  console.log(`RUN tape month=${month} out=${tapePath}`);
  await runEvaluator({ month, tapePath });
  tapePaths.push(tapePath);
}

async function hasValidTape(path: string, month: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      run?: { startAt?: string; endAt?: string };
      assets?: unknown[];
    };
    return parsed.run?.startAt === `${month}-01T00:00:00.000Z`
      && parsed.run?.endAt === `${nextMonthStart(month)}T00:00:00.000Z`
      && Array.isArray(parsed.assets);
  } catch (error: unknown) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

if (learnerOut) {
  await runLearner(tapePaths);
}

async function runEvaluator(input: {
  month: string;
  tapePath: string;
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
      "--trades-limit",
      "0",
      chunkDays ? "--chunk-days" : "--chunk-months",
      "--trade-tape-out",
      input.tapePath,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`trade-tape evaluation failed month=${input.month}: ${stderr || stdout}`);
  }
  const final = stdout.match(/FINAL\s+judgeable_trades=(\d+) unjudgeable_trades=(\d+) wins=(\d+) losses=(\d+) totalR=([-\d.]+)/m);
  console.log(final ? `DONE ${input.month} judgeable=${final[1]} wins=${final[3]} losses=${final[4]} totalR=${final[5]}` : `DONE ${input.month}`);
}

async function runLearner(tapePaths: string[]): Promise<void> {
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "--conditions",
      "react-server",
      "scripts/learn-reader-trade-tapes.ts",
      "--tapes",
      tapePaths.join(","),
      "--out",
      learnerOut!,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`learner failed: ${stderr || stdout}`);
  }
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

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}
