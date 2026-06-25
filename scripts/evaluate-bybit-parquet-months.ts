import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type MonthResult = {
  month: string;
  mode: string;
  judgeableTrades: number;
  unjudgeableTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  decision: string;
};

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
const modes = parseModes(arg("modes", "utc-day,rolling,liquidity-session"));
const marketStoreRoot = arg("market-store-root", "market-store")!;
const bucketEventMode = parseBucketEventMode(arg("bucket-event-mode", "split"));
const auctionLevelCandles = optionalPositiveInteger(arg("auction-level-candles"), "--auction-level-candles");
const profileTradeSampleLimit = optionalPositiveInteger(arg("profile-trade-sample-limit"), "--profile-trade-sample-limit");
const readerRadar = arg("reader-radar");
const readerRadarMaxStaleMs = optionalPositiveInteger(arg("reader-radar-max-stale-ms"), "--reader-radar-max-stale-ms");
const tradeStyle = arg("trade-style");
const out = arg("out", join("docs", "strategy-lab", `btcusdt-mode-comparison-${startMonth}-${endMonth}.md`))!;
const concurrency = parsePositiveInteger(arg("concurrency", "1"), "--concurrency");
const chunkDays = hasFlag("chunk-days");

const results: MonthResult[] = await loadExistingResults();
let writeQueue = Promise.resolve();
const jobs = modes.flatMap((mode) => monthRange(startMonth, endMonth).map((month) => ({ mode, month })))
  .filter((job) => !hasResult(job.mode, job.month));
if (jobs.length === 0) {
  console.log("All requested mode/month evaluations already exist.");
  await queueWriteResults();
} else {
  console.log(`Queued ${jobs.length} evaluations with concurrency=${concurrency}`);
  await runWithConcurrency(jobs, concurrency, async (job) => {
    const start = `${job.month}-01`;
    const end = nextMonthStart(job.month);
    console.log(`RUN mode=${job.mode} month=${job.month}`);
    const output = await runEvaluator({ mode: job.mode, start, end });
    const result = parseResult({ mode: job.mode, month: job.month, output });
    upsertResult(result);
    console.log(`${job.mode} ${job.month} trades=${result.judgeableTrades} wins=${result.wins} losses=${result.losses} totalR=${result.totalR} maxDD=${result.maxDrawdownR} decision=${result.decision}`);
    await queueWriteResults();
  });
}
process.exit(0);

async function runEvaluator(input: {
  mode: string;
  start: string;
  end: string;
}): Promise<string> {
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
      input.start,
      "--end",
      input.end,
      "--data-mode",
      "parquet",
      "--market-store-root",
      marketStoreRoot,
      "--bucket-event-mode",
      bucketEventMode,
      "--narrative-session-mode",
      input.mode,
      ...(auctionLevelCandles === undefined ? [] : ["--auction-level-candles", String(auctionLevelCandles)]),
      ...(profileTradeSampleLimit === undefined ? [] : ["--profile-trade-sample-limit", String(profileTradeSampleLimit)]),
      ...(readerRadar === undefined ? [] : ["--reader-radar", readerRadar]),
      ...(readerRadarMaxStaleMs === undefined ? [] : ["--reader-radar-max-stale-ms", String(readerRadarMaxStaleMs)]),
      ...(tradeStyle === undefined ? [] : ["--trade-style", tradeStyle]),
      "--summary-only",
      chunkDays ? "--chunk-days" : "--chunk-months",
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
    throw new Error(`evaluation failed mode=${input.mode} start=${input.start}: ${stderr || stdout}`);
  }
  return stdout;
}

function parseResult(input: {
  mode: string;
  month: string;
  output: string;
}): MonthResult {
  const summary = input.output.match(/judgeable_trades=(\d+) unjudgeable_trades=(\d+) wins=(\d+) losses=(\d+) totalR=([-\d.]+) avgR=([-\d.]+) maxDD=([-\d.]+)/);
  const decision = input.output.match(/decision=([A-Z_]+)/g)?.at(-1)?.replace("decision=", "");
  if (!summary || !decision) {
    throw new Error(`could not parse evaluation output for ${input.mode} ${input.month}`);
  }
  return {
    month: input.month,
    mode: input.mode,
    judgeableTrades: Number(summary[1]),
    unjudgeableTrades: Number(summary[2]),
    wins: Number(summary[3]),
    losses: Number(summary[4]),
    totalR: Number(summary[5]),
    averageR: Number(summary[6]),
    maxDrawdownR: Number(summary[7]),
    decision,
  };
}

async function writeResults(): Promise<void> {
  await mkdir(dirname(out), { recursive: true });
  const sortedResults = sortedResultsForOutput();
  await writeFile(out.replace(/\.md$/, ".json"), `${JSON.stringify({ symbol, startMonth, endMonth, bucketEventMode, auctionLevelCandles, profileTradeSampleLimit, readerRadar, readerRadarMaxStaleMs, tradeStyle, chunking: chunkDays ? "days" : "months", results: sortedResults }, null, 2)}\n`, "utf8");
  await writeFile(out, markdownFor(), "utf8");
}

async function queueWriteResults(): Promise<void> {
  writeQueue = writeQueue.then(writeResults);
  await writeQueue;
}

function markdownFor(): string {
  const lines = [
    `# ${symbol} Narrative Mode Comparison`,
    "",
    `Range: ${startMonth} to ${endMonth}`,
    `Bucket event mode: ${bucketEventMode}`,
    `Auction level candles: ${auctionLevelCandles ?? "all"}`,
    `Profile trade sample limit: ${profileTradeSampleLimit ?? "default"}`,
    `Reader radar: ${readerRadar ?? "default"}`,
    `Reader radar max stale ms: ${readerRadarMaxStaleMs ?? "default"}`,
    `Trade style: ${tradeStyle ?? "default"}`,
    `Chunking: ${chunkDays ? "days" : "months"}`,
    "",
  ];
  for (const mode of modes) {
    const modeResults = sortedResultsForOutput().filter((result) => result.mode === mode);
    lines.push(`## ${mode}`, "");
    lines.push("| Month | Trades | Wins | Losses | Total R | Avg R | Max DD | Decision |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const result of modeResults) {
      lines.push(`| ${result.month} | ${result.judgeableTrades} | ${result.wins} | ${result.losses} | ${format(result.totalR)} | ${format(result.averageR)} | ${format(result.maxDrawdownR)} | ${result.decision} |`);
    }
    if (modeResults.length > 0) {
      const summary = summarize(modeResults);
      lines.push("");
      lines.push(`Aggregate: trades=${summary.trades} wins=${summary.wins} losses=${summary.losses} totalR=${format(summary.totalR)} avgR=${format(summary.averageR)} worstMonthMaxDD=${format(summary.worstMonthMaxDrawdownR)} monthLevelMaxDD=${format(summary.monthLevelMaxDrawdownR)}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function loadExistingResults(): Promise<MonthResult[]> {
  const jsonPath = out.replace(/\.md$/, ".json");
  try {
    const parsed = JSON.parse(await readFile(jsonPath, "utf8")) as {
      bucketEventMode?: string;
      auctionLevelCandles?: number;
      profileTradeSampleLimit?: number;
      readerRadar?: string;
      readerRadarMaxStaleMs?: number;
      tradeStyle?: string;
      chunking?: string;
      results?: MonthResult[];
    };
    if (parsed.bucketEventMode !== undefined && parsed.bucketEventMode !== bucketEventMode) return [];
    if (parsed.auctionLevelCandles !== auctionLevelCandles) return [];
    if (parsed.profileTradeSampleLimit !== profileTradeSampleLimit) return [];
    if (parsed.readerRadar !== readerRadar) return [];
    if (parsed.readerRadarMaxStaleMs !== readerRadarMaxStaleMs) return [];
    if (parsed.tradeStyle !== tradeStyle) return [];
    if (parsed.chunking !== undefined && parsed.chunking !== (chunkDays ? "days" : "months")) return [];
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch (error: unknown) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

function hasResult(mode: string, month: string): boolean {
  return results.some((result) => result.mode === mode && result.month === month);
}

function upsertResult(result: MonthResult): void {
  const existingIndex = results.findIndex((candidate) => candidate.mode === result.mode && candidate.month === result.month);
  if (existingIndex >= 0) {
    results[existingIndex] = result;
    return;
  }
  results.push(result);
}

function sortedResultsForOutput(): MonthResult[] {
  const modeOrder = new Map(modes.map((mode, index) => [mode, index]));
  return [...results].sort((left, right) => {
    const modeDelta = (modeOrder.get(left.mode) ?? 999) - (modeOrder.get(right.mode) ?? 999);
    return modeDelta || left.month.localeCompare(right.month);
  });
}

async function runWithConcurrency<T>(
  jobs: T[],
  limit: number,
  run: (job: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      await run(job);
    }
  });
  await Promise.all(workers);
}

function summarize(items: MonthResult[]) {
  const trades = items.reduce((sum, item) => sum + item.judgeableTrades, 0);
  const wins = items.reduce((sum, item) => sum + item.wins, 0);
  const losses = items.reduce((sum, item) => sum + item.losses, 0);
  const totalR = items.reduce((sum, item) => sum + item.totalR, 0);
  return {
    trades,
    wins,
    losses,
    totalR,
    averageR: trades === 0 ? 0 : totalR / trades,
    worstMonthMaxDrawdownR: items.reduce((worst, item) => Math.min(worst, item.maxDrawdownR), 0),
    monthLevelMaxDrawdownR: monthLevelMaxDrawdown(items.map((item) => item.totalR)),
  };
}

function monthLevelMaxDrawdown(values: number[]): number {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }
  return drawdown;
}

function parseModes(value: string | undefined): string[] {
  const parsed = (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error("--modes must include at least one mode");
  for (const mode of parsed) {
    if (mode !== "utc-day" && mode !== "rolling" && mode !== "liquidity-session") throw new Error(`unsupported mode ${mode}`);
  }
  return parsed;
}

function parseBucketEventMode(value: string | undefined): "split" | "aggregate" {
  if (value === "aggregate") return "aggregate";
  if (value === "split") return "split";
  throw new Error("--bucket-event-mode must be split or aggregate");
}

function parseMonth(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) throw new Error("--start-month and --end-month must use YYYY-MM");
  const parsed = Date.parse(`${value}-01T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) throw new Error(`invalid month ${value}`);
  return value;
}

function parsePositiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  return parsePositiveInteger(value, name);
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

function nextMonthStart(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function format(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}

