import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  summarizeReaderTradeFragility,
  type ReaderBadAttemptTrade,
  type ReaderFragilitySummary,
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
const riskPct = numberArg("risk-pct", 0.25);
const monteCarloRuns = integerArg("monte-carlo-runs", 2_000);
const seed = integerArg("seed", 13_371);

if (tapePaths.length === 0) throw new Error("--tapes must include one or more trade-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const trades = tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
const summary = summarizeReaderTradeFragility({
  trades,
  options: {
    riskPct,
    monteCarloRuns,
    seed,
  },
});

printSummary(summary);
if (out) await writeReport(out, summary);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a finite number`);
  return parsed;
}

function integerArg(name: string, fallback: number): number {
  const parsed = numberArg(name, fallback);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer`);
  return parsed;
}

async function readTape(path: string): Promise<TradeTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
}

function printSummary(summary: ReaderFragilitySummary): void {
  console.log("READER FRAGILITY");
  console.log(`trades=${summary.trades} wins=${summary.wins} losses=${summary.losses} winRate=${pct(summary.winRate)}`);
  console.log(`total=${r(summary.totalR)} avg=${r(summary.averageR)} grossWin=${r(summary.grossWinR)} grossLoss=${r(summary.grossLossR)} profitFactor=${profitFactor(summary)}`);
  console.log(`best=${nullableR(summary.bestR)} worst=${nullableR(summary.worstR)} topWin=${nullableR(summary.topWinR)} top3Wins=${r(summary.topThreeWinR)} topWinGrossShare=${nullablePct(summary.topWinShareOfGrossWin)} topWinTotalShare=${nullablePct(summary.topWinShareOfTotal)}`);
  console.log(`chronological maxDD=${r(summary.chronological.maxDrawdownR)} minEquity=${r(summary.chronological.minEquityR)} maxLossStreak=${summary.chronological.maxLossStreak}`);
  console.log(`lossesFirst maxDD=${r(summary.lossesFirst.maxDrawdownR)} minEquity=${r(summary.lossesFirst.minEquityR)} maxLossStreak=${summary.lossesFirst.maxLossStreak}`);
  console.log(`monteCarlo runs=${summary.monteCarlo.runs} p95MaxDD=${r(summary.monteCarlo.maxDrawdownR.p95)} worstMaxDD=${r(summary.monteCarlo.maxDrawdownR.worst)} p95LossStreak=${summary.monteCarlo.maxLossStreak.p95}`);
  console.log(`risk riskPct=${summary.risk.riskPct}% return=${pctNumber(summary.risk.returnPct)} chronologicalMaxDD=${pctNumber(summary.risk.chronologicalMaxDrawdownPct)} lossesFirstMaxDD=${pctNumber(summary.risk.lossesFirstMaxDrawdownPct)} monteCarloP95MaxDD=${pctNumber(summary.risk.monteCarloP95MaxDrawdownPct)}`);
}

async function writeReport(path: string, summary: ReaderFragilitySummary): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(summary), "utf8");
  console.log(`fragility_report=${path}`);
}

function markdownFor(summary: ReaderFragilitySummary): string {
  return [
    "# Reader Fragility",
    "",
    "## Summary",
    "",
    `Trades: ${summary.trades}`,
    `Wins/Losses: ${summary.wins}/${summary.losses}`,
    `Win rate: ${pct(summary.winRate)}`,
    `Total R: ${r(summary.totalR)}`,
    `Average R: ${r(summary.averageR)}`,
    `Gross win/loss R: ${r(summary.grossWinR)} / ${r(summary.grossLossR)}`,
    `Profit factor: ${profitFactor(summary)}`,
    `Best/Worst R: ${nullableR(summary.bestR)} / ${nullableR(summary.worstR)}`,
    `Top win R: ${nullableR(summary.topWinR)}`,
    `Top three wins R: ${r(summary.topThreeWinR)}`,
    `Top win share of gross wins: ${nullablePct(summary.topWinShareOfGrossWin)}`,
    `Top win share of total R: ${nullablePct(summary.topWinShareOfTotal)}`,
    "",
    "## Path Risk",
    "",
    "| Path | Total R | Max DD | Min Equity | Max Loss Streak |",
    "| --- | ---: | ---: | ---: | ---: |",
    pathRow("Chronological", summary.chronological),
    pathRow("Losses first", summary.lossesFirst),
    "",
    "## Monte Carlo",
    "",
    `Runs: ${summary.monteCarlo.runs}`,
    "",
    "| Metric | P50 | P75 | P90 | P95 | P99 | Worst |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    quantileRow("Max DD", summary.monteCarlo.maxDrawdownR, r),
    quantileRow("Min Equity", summary.monteCarlo.minEquityR, r),
    quantileRow("Max loss streak", summary.monteCarlo.maxLossStreak, String),
    "",
    "## Portfolio Projection",
    "",
    `Risk per trade: ${summary.risk.riskPct}%`,
    `Return: ${pctNumber(summary.risk.returnPct)}`,
    `Chronological max DD: ${pctNumber(summary.risk.chronologicalMaxDrawdownPct)}`,
    `Losses-first max DD: ${pctNumber(summary.risk.lossesFirstMaxDrawdownPct)}`,
    `Monte Carlo P95 max DD: ${pctNumber(summary.risk.monteCarloP95MaxDrawdownPct)}`,
    `Monte Carlo worst max DD: ${pctNumber(summary.risk.monteCarloWorstMaxDrawdownPct)}`,
    "",
  ].join("\n");
}

function pathRow(name: string, path: ReaderFragilitySummary["chronological"]): string {
  return `| ${name} | ${r(path.totalR)} | ${r(path.maxDrawdownR)} | ${r(path.minEquityR)} | ${path.maxLossStreak} |`;
}

function quantileRow(
  name: string,
  quantiles: ReaderFragilitySummary["monteCarlo"]["maxDrawdownR"],
  format: (value: number) => string,
): string {
  return [
    name,
    format(quantiles.p50),
    format(quantiles.p75),
    format(quantiles.p90),
    format(quantiles.p95),
    format(quantiles.p99),
    format(quantiles.worst),
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function nullablePct(value: number | null): string {
  return value === null ? "n/a" : pct(value);
}

function pctNumber(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}%`;
}

function r(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function nullableR(value: number | null): string {
  return value === null ? "n/a" : r(value);
}

function profitFactor(summary: ReaderFragilitySummary): string {
  return summary.profitFactor === null ? "n/a" : summary.profitFactor.toFixed(4).replace(/\.?0+$/, "");
}
