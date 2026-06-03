import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  learnReaderCandidateTapes,
  type ReaderCandidateLearnerLesson,
  type ReaderCandidateLearnerReport,
  type ReaderCandidateTapeFile,
} from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = parseList(arg("tapes"));
const minimumSampleForGuidance = optionalPositiveInteger(arg("minimum-sample-for-guidance"), "--minimum-sample-for-guidance");
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes must include one or more candidate-tape JSON paths");

const tapes = await Promise.all(tapePaths.map(readTape));
const report = learnReaderCandidateTapes({
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

async function readTape(path: string): Promise<ReaderCandidateTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as ReaderCandidateTapeFile;
}

function printReport(report: ReaderCandidateLearnerReport): void {
  console.log("READER CANDIDATE LEARNER");
  console.log(summaryLine(report.summary));
  printLessons("paper_promote", report.paperPromoteCandidates, 8);
  printLessons("builder_too_strict", report.builderTooStrictCandidates, 8);
  printLessons("future_avoid", report.futureAvoidCandidates, 8);
  printLessons("noise", report.noiseCandidates, 8);
  printLessons("geometry_artifacts", report.geometryArtifactCandidates, 8);
  printLessons("untradeable_balance", report.untradeableBalanceCandidates, 5);
  printLessons("unjudgeable", report.unjudgeableCandidates, 5);
}

function printLessons(label: string, lessons: ReaderCandidateLearnerLesson[], limit: number): void {
  console.log(label);
  if (lessons.length === 0) {
    console.log("  none");
    return;
  }
  for (const lesson of lessons.slice(0, limit)) {
    console.log(`  ${lesson.guidance} ${summaryLine(lesson.summary)}`);
    console.log(`    key=${lesson.key}`);
    console.log(`    reasons=${lesson.reasons.join(" | ") || "none"}`);
    console.log(`    refs=${lesson.refs.join(",")}`);
  }
}

async function writeReport(path: string, report: ReaderCandidateLearnerReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`candidate_learner_report=${path}`);
}

function markdownFor(report: ReaderCandidateLearnerReport): string {
  return [
    "# Reader Candidate Learner Report",
    "",
    `Candidates: ${report.summary.candidates}`,
    `Judgeable: ${report.summary.judgeable}`,
    `Worked: ${report.summary.worked}`,
    `Invalidated: ${report.summary.invalidated}`,
    `Worked rate: ${format(report.summary.workedRate)}`,
    `Executed: ${report.summary.executed}`,
    `Invalid geometry: ${report.summary.invalidGeometry}`,
    `Average target R: ${formatNullableR(report.summary.avgTargetR)}`,
    `Average target bps: ${formatNullableBps(report.summary.avgTargetBps)}`,
    `Average invalidation bps: ${formatNullableBps(report.summary.avgInvalidationBps)}`,
    `Average result R: ${formatNullableR(report.summary.avgResultR)}`,
    `Average max favorable R: ${formatNullableR(report.summary.avgMaxFavorableR)}`,
    `Average max adverse R: ${formatNullableR(report.summary.avgMaxAdverseR)}`,
    "",
    sectionFor("Paper Promote Candidates", report.paperPromoteCandidates),
    sectionFor("Builder Too Strict Candidates", report.builderTooStrictCandidates),
    sectionFor("Future Avoid Candidates", report.futureAvoidCandidates),
    sectionFor("Noise Candidates", report.noiseCandidates),
    sectionFor("Geometry Artifact Candidates", report.geometryArtifactCandidates),
    sectionFor("Untradeable Balance Candidates", report.untradeableBalanceCandidates),
    sectionFor("Unjudgeable Candidates", report.unjudgeableCandidates),
  ].join("\n");
}

function sectionFor(title: string, lessons: ReaderCandidateLearnerLesson[]): string {
  const lines = [`## ${title}`, ""];
  if (lessons.length === 0) {
    lines.push("None.", "");
    return lines.join("\n");
  }
  for (const lesson of lessons) {
    lines.push(`### ${lesson.guidance} ${lesson.summary.judgeable} judgeable ${lesson.summary.worked}/${lesson.summary.invalidated} worked/invalidated`);
    lines.push("");
    lines.push("```text");
    lines.push(lesson.key);
    lines.push("```");
    lines.push("");
    lines.push(`Candidates: ${lesson.summary.candidates}`);
    lines.push(`Worked rate: ${format(lesson.summary.workedRate)}`);
    lines.push(`Invalid geometry: ${lesson.summary.invalidGeometry}`);
    lines.push(`Average target R: ${formatNullableR(lesson.summary.avgTargetR)}`);
    lines.push(`Average target bps: ${formatNullableBps(lesson.summary.avgTargetBps)}`);
    lines.push(`Average invalidation bps: ${formatNullableBps(lesson.summary.avgInvalidationBps)}`);
    lines.push(`Average result R: ${formatNullableR(lesson.summary.avgResultR)}`);
    lines.push(`Average max favorable R: ${formatNullableR(lesson.summary.avgMaxFavorableR)}`);
    lines.push(`Average max adverse R: ${formatNullableR(lesson.summary.avgMaxAdverseR)}`);
    if (lesson.sampleWarning) lines.push(`Sample: ${lesson.sampleWarning}`);
    lines.push(`Reasons: ${lesson.reasons.join(" | ") || "none"}`);
    lines.push(`Refs: ${lesson.refs.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

function format(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function summaryLine(summary: ReaderCandidateLearnerReport["summary"]): string {
  return [
    `candidates=${summary.candidates}`,
    `judgeable=${summary.judgeable}`,
    `worked=${summary.worked}`,
    `invalidated=${summary.invalidated}`,
    `workedRate=${format(summary.workedRate)}`,
    `avgResultR=${formatNullableR(summary.avgResultR)}`,
    `avgTargetR=${formatNullableR(summary.avgTargetR)}`,
    `avgTargetBps=${formatNullableBps(summary.avgTargetBps)}`,
    `avgInvalidationBps=${formatNullableBps(summary.avgInvalidationBps)}`,
    `avgMAE=${formatNullableR(summary.avgMaxAdverseR)}`,
    `invalidGeometry=${summary.invalidGeometry}`,
    `executed=${summary.executed}`,
  ].join(" ");
}

function formatNullableR(value: number | null): string {
  return value === null ? "n/a" : `${format(value)}R`;
}

function formatNullableBps(value: number | null): string {
  return value === null ? "n/a" : `${format(value)}bps`;
}
