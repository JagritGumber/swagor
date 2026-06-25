import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ReaderCandidate, ReaderCandidateTape } from "../packages/strategy-lab";

type CandidateTapeFile = {
  summary: ReaderCandidateTape["summary"];
  assets: Array<{
    asset: string;
    tape: ReaderCandidateTape;
  }>;
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = parseList(arg("tapes"));
const out = arg("out");
if (tapePaths.length === 0) throw new Error("--tapes must include one or more candidate-tape JSON paths");

const files = await Promise.all(tapePaths.map(readTape));
const candidates = files.flatMap((file) => file.assets.flatMap((asset) => asset.tape.candidates));
const report = reportFor(candidates);
printReport(report);
if (out) await writeReport(out, report);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

async function readTape(path: string): Promise<CandidateTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as CandidateTapeFile;
}

function reportFor(candidates: ReaderCandidate[]) {
  return {
    summary: summarize(candidates),
    byFamily: grouped(candidates, (candidate) => candidate.family),
    byBuilderResponse: grouped(candidates, (candidate) => candidate.builder.response),
    byOutcome: grouped(candidates, (candidate) => candidate.outcome.verdict),
    byFamilyBuilder: grouped(candidates, (candidate) => `${candidate.family}|${candidate.builder.response}`),
    byFamilyOutcome: grouped(candidates, (candidate) => `${candidate.family}|${candidate.outcome.verdict}`),
  };
}

function grouped(candidates: ReaderCandidate[], keyFor: (candidate: ReaderCandidate) => string) {
  const groups = new Map<string, ReaderCandidate[]>();
  for (const candidate of candidates) {
    const key = keyFor(candidate);
    const existing = groups.get(key);
    if (existing) existing.push(candidate);
    else groups.set(key, [candidate]);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, summary: summarize(group), refs: group.slice(0, 12).map(refFor) }))
    .sort((left, right) => right.summary.candidates - left.summary.candidates || left.key.localeCompare(right.key));
}

function summarize(candidates: ReaderCandidate[]) {
  return {
    candidates: candidates.length,
    directional: candidates.filter((candidate) => candidate.side !== null).length,
    worked: candidates.filter((candidate) => candidate.outcome.verdict === "worked").length,
    invalidated: candidates.filter((candidate) => candidate.outcome.verdict === "invalidated").length,
    unresolved: candidates.filter((candidate) => candidate.outcome.verdict === "unresolved").length,
    unjudgeable: candidates.filter((candidate) => candidate.outcome.verdict === "unjudgeable").length,
    executed: candidates.filter((candidate) => candidate.builder.response === "executed").length,
  };
}

function refFor(candidate: ReaderCandidate): string {
  return `${candidate.asset}#${candidate.index}@${new Date(candidate.observedAt).toISOString()}`;
}

function printReport(report: ReturnType<typeof reportFor>): void {
  console.log("READER CANDIDATES");
  console.log(`candidates=${report.summary.candidates} directional=${report.summary.directional} worked=${report.summary.worked} invalidated=${report.summary.invalidated} unresolved=${report.summary.unresolved} unjudgeable=${report.summary.unjudgeable} executed=${report.summary.executed}`);
  printGroups("by_family", report.byFamily);
  printGroups("by_builder", report.byBuilderResponse);
  printGroups("by_outcome", report.byOutcome);
}

function printGroups(label: string, groups: ReturnType<typeof grouped>): void {
  console.log(label);
  for (const group of groups.slice(0, 12)) {
    console.log(`  ${group.key}: candidates=${group.summary.candidates} worked=${group.summary.worked} invalidated=${group.summary.invalidated} unresolved=${group.summary.unresolved} executed=${group.summary.executed}`);
  }
}

async function writeReport(path: string, report: ReturnType<typeof reportFor>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(report), "utf8");
  console.log(`candidate_report=${path}`);
}

function markdownFor(report: ReturnType<typeof reportFor>): string {
  return [
    "# Reader Candidate Report",
    "",
    `Candidates: ${report.summary.candidates}`,
    `Directional: ${report.summary.directional}`,
    `Worked: ${report.summary.worked}`,
    `Invalidated: ${report.summary.invalidated}`,
    `Unresolved: ${report.summary.unresolved}`,
    `Unjudgeable: ${report.summary.unjudgeable}`,
    `Executed: ${report.summary.executed}`,
    "",
    sectionFor("By Family", report.byFamily),
    sectionFor("By Builder Response", report.byBuilderResponse),
    sectionFor("By Outcome", report.byOutcome),
    sectionFor("By Family And Builder", report.byFamilyBuilder),
    sectionFor("By Family And Outcome", report.byFamilyOutcome),
  ].join("\n");
}

function sectionFor(title: string, groups: ReturnType<typeof grouped>): string {
  const lines = [`## ${title}`, ""];
  lines.push("| Key | Candidates | Worked | Invalidated | Unresolved | Unjudgeable | Executed |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const group of groups) {
    lines.push(`| ${escapeTable(group.key)} | ${group.summary.candidates} | ${group.summary.worked} | ${group.summary.invalidated} | ${group.summary.unresolved} | ${group.summary.unjudgeable} | ${group.summary.executed} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

