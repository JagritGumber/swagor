import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  learnReaderTradeTapes,
  replayReaderAfterLearning,
  type ReaderLearnerReplayReport,
  type ReaderTradeTape,
} from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const learnTapePaths = parseList(arg("learn-tapes"));
const replayTapePaths = parseList(arg("replay-tapes"));
const minimumSampleForGuidance = optionalPositiveInteger(arg("minimum-sample-for-guidance"), "--minimum-sample-for-guidance");
const out = arg("out");
const useSampleWarningLessons = hasFlag("use-sample-warning-lessons");

if (learnTapePaths.length === 0) throw new Error("--learn-tapes must include one or more trade-tape JSON paths");
if (replayTapePaths.length === 0) throw new Error("--replay-tapes must include one or more trade-tape JSON paths");

const [learnTapes, replayTapes] = await Promise.all([
  Promise.all(learnTapePaths.map(readTape)),
  Promise.all(replayTapePaths.map(readTape)),
]);
const learner = learnReaderTradeTapes({
  tapes: learnTapes,
  ...(minimumSampleForGuidance === undefined ? {} : { minimumSampleForGuidance }),
});
const report = replayReaderAfterLearning({ learner, tapes: replayTapes, useSampleWarningLessons });

printReport(report);
if (out) await writeReport(out, report);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function readTape(path: string): Promise<ReaderTradeTape> {
  return JSON.parse(await readFile(path, "utf8")) as ReaderTradeTape;
}

function printReport(report: ReaderLearnerReplayReport): void {
  console.log("READER AFTER LEARNING");
  console.log(`baseline trades=${report.baseline.judgeableTrades} wins=${report.baseline.wins} losses=${report.baseline.losses} totalR=${format(report.baseline.totalR)} avgR=${format(report.baseline.averageR)}`);
  console.log(`learned trades=${report.learned.judgeableTrades} wins=${report.learned.wins} losses=${report.learned.losses} totalR=${format(report.learned.totalR)} avgR=${format(report.learned.averageR)}`);
  console.log(`skipped trades=${report.skipped.judgeableTrades} wins=${report.skipped.wins} losses=${report.skipped.losses} totalR=${format(report.skipped.totalR)} avgR=${format(report.skipped.averageR)}`);
  for (const item of report.trades) {
    console.log(`${item.decision} ${item.trade.asset}#${item.trade.index}@${item.trade.entryAt} ${item.trade.side} r=${formatNullable(item.trade.result.r)} reasons=${item.reasons.join(" | ") || "none"}`);
  }
}

async function writeReport(path: string, report: ReaderLearnerReplayReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`after_learning_report=${path}`);
}

function markdownFor(report: ReaderLearnerReplayReport): string {
  const lines = [
    "# Reader After Learning Replay",
    "",
    "| Case | Trades | Wins | Losses | Total R | Avg R |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| Baseline | ${report.baseline.judgeableTrades} | ${report.baseline.wins} | ${report.baseline.losses} | ${format(report.baseline.totalR)} | ${format(report.baseline.averageR)} |`,
    `| Learned | ${report.learned.judgeableTrades} | ${report.learned.wins} | ${report.learned.losses} | ${format(report.learned.totalR)} | ${format(report.learned.averageR)} |`,
    `| Skipped | ${report.skipped.judgeableTrades} | ${report.skipped.wins} | ${report.skipped.losses} | ${format(report.skipped.totalR)} | ${format(report.skipped.averageR)} |`,
    "",
    "## Trades",
    "",
  ];
  for (const item of report.trades) {
    lines.push(`- ${item.decision}: ${item.trade.asset}#${item.trade.index}@${item.trade.entryAt} ${item.trade.side} R=${formatNullable(item.trade.result.r)}; ${item.reasons.join(" | ") || "none"}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatNullable(value: number | null): string {
  return value === null ? "n/a" : format(value);
}

function format(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}
