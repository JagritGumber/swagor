import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

const tapePaths = parseList(arg("tapes"));
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes must include one or more trade-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const trades = tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
const report = compareReaderAttemptHypotheses({ trades });

printReport(report);
if (out) await writeReport(out, report);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

async function readTape(path: string): Promise<TradeTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
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
    "| Hypothesis | Kept Trades | Kept W/L | Kept Win Rate | Kept R | Kept Gross W/L | Kept PF | Kept Max DD | Kept Losses-First DD | Removed Trades | Removed W/L | Removed R | Removed Losses-First DD | Description |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.results.map(rowFor),
    "",
  ].join("\n");
}

function rowFor(result: ReaderAttemptHypothesisResult): string {
  return [
    result.key,
    result.kept.trades,
    `${result.kept.wins}/${result.kept.losses}`,
    pct(result.kept.winRate),
    r(result.kept.totalR),
    `${r(result.kept.grossWinR)} / ${r(result.kept.grossLossR)}`,
    profitFactor(result.kept),
    r(result.kept.maxDrawdownR),
    r(result.kept.lossesFirstMaxDrawdownR),
    result.removed.trades,
    `${result.removed.wins}/${result.removed.losses}`,
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
