import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  compareReaderAttemptHypotheses,
  type ReaderAttemptHypothesisReport,
  type ReaderAttemptHypothesisResult,
  type ReaderBadAttemptSummary,
  type ReaderBadAttemptTrade,
} from "../packages/strategy-lab";

type TradeTapeFile = {
  assets: Array<{
    trades: ReaderBadAttemptTrade[];
  }>;
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = await tapePathsForInput();
const costRPerTrade = costRPerTradeFor({
  riskPct: numberArg("risk-pct", 0),
  feePct: numberArg("fee-pct", 0),
  slippagePct: numberArg("slippage-pct", 0),
});
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes or --tape-dir must include one or more trade-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const trades = tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
const report = compareReaderAttemptHypotheses({ trades, costRPerTrade });

printReport(report);
if (out) await writeReport(out, report);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

async function tapePathsForInput(): Promise<string[]> {
  const explicit = parseList(arg("tapes"));
  const tapeDir = arg("tape-dir");
  if (!tapeDir) return explicit;
  const pattern = arg("pattern", ".json") ?? ".json";
  const fromDir = (await readdir(tapeDir))
    .filter((name) => name.includes(pattern))
    .sort()
    .map((name) => join(tapeDir, name));
  return [...explicit, ...fromDir];
}

async function readTape(path: string): Promise<TradeTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a finite number`);
  return parsed;
}

function costRPerTradeFor(input: {
  riskPct: number;
  feePct: number;
  slippagePct: number;
}): number {
  if (input.feePct === 0 && input.slippagePct === 0) return 0;
  if (input.riskPct <= 0) throw new Error("--risk-pct is required and must be positive when fee/slippage costs are provided");
  return (input.feePct + input.slippagePct) / input.riskPct;
}

function printReport(report: ReaderAttemptHypothesisReport): void {
  console.log("READER ATTEMPT HYPOTHESES");
  console.log(`baseline ${summaryLine(report.baseline)}`);
  for (const result of report.results) {
    console.log(`${result.key} kept=${summaryLine(result.kept)} removed=${summaryLine(result.removed)}`);
    console.log(`  ${result.description}`);
  }
}

async function writeReport(path: string, report: ReaderAttemptHypothesisReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`attempt_hypothesis_report=${path}`);
}

function markdownFor(report: ReaderAttemptHypothesisReport): string {
  return [
    "# Reader Attempt Hypotheses",
    "",
    "## Baseline",
    "",
    summaryBlock(report.baseline),
    "## Hypotheses",
    "",
    "| Hypothesis | Cost | Kept Trades | Kept W/L | Kept Win Rate | Kept Raw R | Kept Net R | Kept Net Gross W/L | Kept PF | Kept Max DD | Kept Losses-First DD | Removed Trades | Removed W/L | Removed Raw R | Removed Net R | Removed Losses-First DD | Description |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.results.map(rowFor),
    "",
  ].join("\n");
}

function rowFor(result: ReaderAttemptHypothesisResult): string {
  return [
    result.key,
    r(result.kept.costRPerTrade),
    result.kept.trades,
    `${result.kept.wins}/${result.kept.losses}`,
    pct(result.kept.winRate),
    r(result.kept.rawTotalR),
    r(result.kept.totalR),
    `${r(result.kept.grossWinR)} / ${r(result.kept.grossLossR)}`,
    profitFactor(result.kept),
    r(result.kept.maxDrawdownR),
    r(result.kept.lossesFirstMaxDrawdownR),
    result.removed.trades,
    `${result.removed.wins}/${result.removed.losses}`,
    r(result.removed.rawTotalR),
    r(result.removed.totalR),
    r(result.removed.lossesFirstMaxDrawdownR),
    result.description,
  ].map((value) => escapeTable(String(value))).join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function summaryBlock(summary: ReaderBadAttemptSummary): string {
  return [
    `Trades: ${summary.trades}`,
    `Wins/Losses: ${summary.wins}/${summary.losses}`,
    `Win rate: ${pct(summary.winRate)}`,
    `Cost per trade: ${r(summary.costRPerTrade)}`,
    `Raw total R: ${r(summary.rawTotalR)}`,
    `Total R: ${r(summary.totalR)}`,
    `Average R: ${r(summary.averageR)}`,
    `Gross win/loss R: ${r(summary.grossWinR)} / ${r(summary.grossLossR)}`,
    `Profit factor: ${summary.profitFactor === null ? "n/a" : summary.profitFactor.toFixed(4).replace(/\.?0+$/, "")}`,
    `Max drawdown R: ${r(summary.maxDrawdownR)}`,
    `Minimum equity R: ${r(summary.minEquityR)}`,
    `Losses-first max drawdown R: ${r(summary.lossesFirstMaxDrawdownR)}`,
    `Losses-first minimum equity R: ${r(summary.lossesFirstMinEquityR)}`,
    `Max loss streak: ${summary.maxLossStreak}`,
    "",
  ].join("\n");
}

function summaryLine(summary: ReaderBadAttemptSummary): string {
  return [
    `trades=${summary.trades}`,
    `wins=${summary.wins}`,
    `losses=${summary.losses}`,
    `winRate=${pct(summary.winRate)}`,
    `cost=${r(summary.costRPerTrade)}`,
    `rawTotalR=${r(summary.rawTotalR)}`,
    `totalR=${r(summary.totalR)}`,
    `avgR=${r(summary.averageR)}`,
    `grossWin=${r(summary.grossWinR)}`,
    `grossLoss=${r(summary.grossLossR)}`,
    `profitFactor=${summary.profitFactor === null ? "n/a" : summary.profitFactor.toFixed(4).replace(/\.?0+$/, "")}`,
    `maxDD=${r(summary.maxDrawdownR)}`,
    `lossesFirstDD=${r(summary.lossesFirstMaxDrawdownR)}`,
    `maxLossStreak=${summary.maxLossStreak}`,
  ].join(" ");
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function r(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function profitFactor(summary: ReaderBadAttemptSummary): string {
  return summary.profitFactor === null ? "n/a" : summary.profitFactor.toFixed(4).replace(/\.?0+$/, "");
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

