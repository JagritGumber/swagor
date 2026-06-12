import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  profileReaderBadAttempts,
  type ReaderBadAttemptGroup,
  type ReaderBadAttemptReport,
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
const minimumGroupSize = requiredPositiveInteger(arg("minimum-group-size"), "--minimum-group-size");
const costRPerTrade = costRPerTradeFor({
  riskPct: numberArg("risk-pct", 0),
  feePct: numberArg("fee-pct", 0),
  slippagePct: numberArg("slippage-pct", 0),
});
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes or --tape-dir must include one or more trade-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const trades = tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
const report = profileReaderBadAttempts({ trades, minimumGroupSize, costRPerTrade });

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

function requiredPositiveInteger(value: string | undefined, name: string): number {
  if (value === undefined || value === "") throw new Error(`${name} is required so this profiler has no hidden sample policy`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
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

async function readTape(path: string): Promise<TradeTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as TradeTapeFile;
}

function printReport(report: ReaderBadAttemptReport): void {
  console.log("READER BAD ATTEMPT PROFILE");
  console.log(summaryLine(report.summary));
  printGroups("worst_bad_attempt_groups", report.badAttemptGroups, 12);
  printGroups("best_winner_groups", report.winnerGroups, 8);
  printGroups("feature_groups", report.featureGroups, 18);
}

function printGroups(label: string, groups: ReaderBadAttemptGroup[], limit: number): void {
  console.log(label);
  if (groups.length === 0) {
    console.log("  none");
    return;
  }
  for (const group of groups.slice(0, limit)) {
    console.log(`  ${summaryLine(group.summary)}`);
    console.log(`    key=${group.key}`);
    console.log(`    refs=${group.refs.join(",")}`);
  }
}

async function writeReport(path: string, report: ReaderBadAttemptReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`bad_attempt_report=${path}`);
}

function markdownFor(report: ReaderBadAttemptReport): string {
  return [
    "# Reader Bad Attempt Profile",
    "",
    summaryBlock(report.summary),
    sectionFor("Worst Bad Attempt Groups", report.badAttemptGroups),
    sectionFor("Best Winner Groups", report.winnerGroups),
    sectionFor("Feature Groups", report.featureGroups),
  ].join("\n");
}

function sectionFor(title: string, groups: ReaderBadAttemptGroup[]): string {
  const lines = [`## ${title}`, ""];
  if (groups.length === 0) {
    lines.push("None.", "");
    return lines.join("\n");
  }
  lines.push("| Key | Trades | W/L | Win Rate | Cost | Raw R | Net R | Net Gross W/L | Profit Factor | Avg R | Max DD R | Losses-First DD R | Max Loss Streak | Refs |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const group of groups) {
    lines.push([
      escapeTable(group.key),
      group.summary.trades,
      `${group.summary.wins}/${group.summary.losses}`,
      formatPct(group.summary.winRate),
      formatR(group.summary.costRPerTrade),
      formatR(group.summary.rawTotalR),
      formatR(group.summary.totalR),
      `${formatR(group.summary.grossWinR)} / ${formatR(group.summary.grossLossR)}`,
      profitFactor(group.summary),
      formatR(group.summary.averageR),
      formatR(group.summary.maxDrawdownR),
      formatR(group.summary.lossesFirstMaxDrawdownR),
      group.summary.maxLossStreak,
      escapeTable(group.refs.join(", ")),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  return lines.join("\n");
}

function summaryBlock(summary: ReaderBadAttemptReport["summary"]): string {
  return [
    `Trades: ${summary.trades}`,
    `Wins/Losses: ${summary.wins}/${summary.losses}`,
    `Win rate: ${formatPct(summary.winRate)}`,
    `Cost per trade: ${formatR(summary.costRPerTrade)}`,
    `Raw total R: ${formatR(summary.rawTotalR)}`,
    `Total R: ${formatR(summary.totalR)}`,
    `Average R: ${formatR(summary.averageR)}`,
    `Gross win/loss R: ${formatR(summary.grossWinR)} / ${formatR(summary.grossLossR)}`,
    `Profit factor: ${profitFactor(summary)}`,
    `Best/Worst R: ${nullableR(summary.bestR)} / ${nullableR(summary.worstR)}`,
    `Max drawdown R: ${formatR(summary.maxDrawdownR)}`,
    `Minimum equity R: ${formatR(summary.minEquityR)}`,
    `Losses-first max drawdown R: ${formatR(summary.lossesFirstMaxDrawdownR)}`,
    `Losses-first minimum equity R: ${formatR(summary.lossesFirstMinEquityR)}`,
    `Max loss streak: ${summary.maxLossStreak}`,
    "",
  ].join("\n");
}

function summaryLine(summary: ReaderBadAttemptReport["summary"]): string {
  return [
    `trades=${summary.trades}`,
    `wins=${summary.wins}`,
    `losses=${summary.losses}`,
    `winRate=${formatPct(summary.winRate)}`,
    `cost=${formatR(summary.costRPerTrade)}`,
    `rawTotalR=${formatR(summary.rawTotalR)}`,
    `totalR=${formatR(summary.totalR)}`,
    `avgR=${formatR(summary.averageR)}`,
    `grossWin=${formatR(summary.grossWinR)}`,
    `grossLoss=${formatR(summary.grossLossR)}`,
    `profitFactor=${profitFactor(summary)}`,
    `bestR=${nullableR(summary.bestR)}`,
    `worstR=${nullableR(summary.worstR)}`,
    `maxDD=${formatR(summary.maxDrawdownR)}`,
    `lossesFirstDD=${formatR(summary.lossesFirstMaxDrawdownR)}`,
    `minEquity=${formatR(summary.minEquityR)}`,
    `maxLossStreak=${summary.maxLossStreak}`,
  ].join(" ");
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatR(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function nullableR(value: number | null): string {
  return value === null ? "n/a" : formatR(value);
}

function profitFactor(summary: ReaderBadAttemptReport["summary"]): string {
  return summary.profitFactor === null ? "n/a" : summary.profitFactor.toFixed(4).replace(/\.?0+$/, "");
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}
