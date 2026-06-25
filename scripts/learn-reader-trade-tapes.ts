import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  learnReaderTradeTapes,
  type ReaderLearnerLesson,
  type ReaderLearnerReport,
  type ReaderTradeTape,
} from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = parseList(arg("tapes"));
const minimumSampleForGuidance = optionalPositiveInteger(arg("minimum-sample-for-guidance"), "--minimum-sample-for-guidance");
const out = arg("out");

if (tapePaths.length === 0) {
  throw new Error("--tapes must include one or more trade-tape JSON paths");
}

const tapes = await Promise.all(tapePaths.map(readTape));
const report = learnReaderTradeTapes({
  tapes,
  ...(minimumSampleForGuidance === undefined ? {} : { minimumSampleForGuidance }),
});

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

function printReport(report: ReaderLearnerReport): void {
  console.log("READER LEARNER");
  console.log(`trades=${report.summary.judgeableTrades} wins=${report.summary.wins} losses=${report.summary.losses} totalR=${format(report.summary.totalR)} avgR=${format(report.summary.averageR)} winRate=${format(report.summary.winRate)}`);
  printLessons("playbook", report.playbookLessons, 8);
  printLessons("avoid", report.avoidLessons, 8);
  printLessons("scale", report.scaleLessons, 8);
  printLessons("sample_warnings", report.sampleWarnings, 8);
  printLessons("data_quality", report.dataQualityLessons, 8);
}

function printLessons(label: string, lessons: ReaderLearnerLesson[], limit: number): void {
  console.log(label);
  if (lessons.length === 0) {
    console.log("  none");
    return;
  }
  for (const lesson of lessons.slice(0, limit)) {
    console.log(`  ${lesson.guidance} trades=${lesson.summary.judgeableTrades} wins=${lesson.summary.wins} losses=${lesson.summary.losses} totalR=${format(lesson.summary.totalR)} avgR=${format(lesson.summary.averageR)} key=${lesson.key}`);
    if (lesson.outcomeKey) console.log(`    outcome=${lesson.outcomeKey}`);
    console.log(`    reasons=${lesson.reasons.join(" | ") || "none"}`);
    console.log(`    refs=${lesson.tradeRefs.join(",")}`);
  }
}

async function writeReport(path: string, report: ReaderLearnerReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`learner_report=${path}`);
}

function markdownFor(report: ReaderLearnerReport): string {
  return [
    "# Reader Learner Report",
    "",
    `Trades: ${report.summary.judgeableTrades}`,
    `Wins: ${report.summary.wins}`,
    `Losses: ${report.summary.losses}`,
    `Total R: ${format(report.summary.totalR)}`,
    `Average R: ${format(report.summary.averageR)}`,
    `Win rate: ${format(report.summary.winRate)}`,
    "",
    markdownLessons("Playbook Lessons", report.playbookLessons),
    markdownLessons("Avoid Lessons", report.avoidLessons),
    markdownLessons("Scale Lessons", report.scaleLessons),
    markdownLessons("Sample Warnings", report.sampleWarnings),
    markdownLessons("Data Quality Lessons", report.dataQualityLessons),
  ].join("\n");
}

function markdownLessons(title: string, lessons: ReaderLearnerLesson[]): string {
  const lines = [`## ${title}`, ""];
  if (lessons.length === 0) {
    lines.push("None.", "");
    return lines.join("\n");
  }
  for (const lesson of lessons) {
    lines.push(`### ${lesson.guidance} ${lesson.summary.judgeableTrades} trades ${lesson.summary.wins}/${lesson.summary.losses} ${format(lesson.summary.totalR)}R`);
    lines.push("");
    lines.push("```text");
    lines.push(lesson.key);
    if (lesson.outcomeKey) lines.push(`outcome: ${lesson.outcomeKey}`);
    lines.push("```");
    lines.push("");
    lines.push(`Avg R: ${format(lesson.summary.averageR)}`);
    lines.push(`Reasons: ${lesson.reasons.join(" | ") || "none"}`);
    lines.push(`Refs: ${lesson.tradeRefs.join(", ")}`);
    lines.push("");
  }
  lines.push("");
  return lines.join("\n");
}

function format(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

