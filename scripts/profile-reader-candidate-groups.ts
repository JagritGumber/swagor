import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  profileReaderCandidateGroups,
  type ReaderCandidateGroup,
  type ReaderCandidateGroupProfile,
  type ReaderCandidateReactionFilter,
  type ReaderCandidateTape,
} from "../packages/strategy-lab";

type CandidateTapeFile = {
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
const minimumGroupSize = positiveInteger(arg("minimum-group-size", "5"), "--minimum-group-size");
const out = arg("out");

if (tapePaths.length === 0) throw new Error("--tapes must include one or more candidate-tape JSON paths");

const filter: ReaderCandidateReactionFilter = {
  family: arg("family"),
  side: arg("side"),
  auctionLocation: arg("auction-location"),
  auctionLevelKind: arg("auction-level-kind"),
  auctionMode: arg("auction-mode"),
  auctionPhase: arg("auction-phase"),
  vpAuction: arg("vp-auction"),
  vpPoc: arg("vp-poc"),
  vpValue: arg("vp-value"),
  orderflowPressure: arg("orderflow-pressure"),
  narrativeIntent: arg("narrative-intent"),
  narrativeDirection: arg("narrative-direction"),
  localRangeLocation: arg("local-range-location"),
  builderResponse: arg("builder-response"),
  firstReaction: arg("first-reaction"),
  riskTargetOnly: flag("risk-target-only"),
};

const files = await Promise.all(tapePaths.map(readTape));
const candidates = files.flatMap((file) => file.assets.flatMap((asset) => asset.tape.candidates));
const profile = profileReaderCandidateGroups({ candidates, filter, minimumGroupSize });

printProfile(profile);
if (out) await writeProfile(out, profile);

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function readTape(path: string): Promise<CandidateTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as CandidateTapeFile;
}

function printProfile(profile: ReaderCandidateGroupProfile): void {
  console.log("READER CANDIDATE GROUP PROFILE");
  console.log(`filter=${JSON.stringify(profile.filter)} minimumGroupSize=${profile.minimumGroupSize}`);
  for (const group of profile.groups.slice(0, 30)) {
    console.log(`${group.key} ${summaryLine(group.summary)}`);
  }
}

async function writeProfile(path: string, profile: ReaderCandidateGroupProfile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(profile), "utf8");
  console.log(`candidate_group_profile=${path}`);
}

function markdownFor(profile: ReaderCandidateGroupProfile): string {
  return [
    "# Reader Candidate Group Profile",
    "",
    "## Filter",
    "",
    "```json",
    JSON.stringify(profile.filter, null, 2),
    "```",
    "",
    `Minimum group size: ${profile.minimumGroupSize}`,
    "",
    "| Group | Candidates | Worked/Invalidated | Worked Rate | Total R | Max DD | Min Equity | Median R | Median First Reaction R | Median Target R | Refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...profile.groups.map(groupRow),
    "",
  ].join("\n");
}

function groupRow(group: ReaderCandidateGroup): string {
  return [
    group.key,
    group.summary.candidates,
    `${group.summary.worked}/${group.summary.invalidated}`,
    pct(group.summary.workedRate),
    r(group.summary.totalR),
    r(group.summary.maxDrawdownR),
    r(group.summary.minEquityR),
    nullableR(group.summary.medianR),
    nullableR(group.summary.medianFirstReactionR),
    nullableR(group.summary.medianTargetR),
    group.refs.join(", "),
  ].map((value) => escapeTable(String(value))).join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function summaryLine(summary: ReaderCandidateGroup["summary"]): string {
  return [
    `candidates=${summary.candidates}`,
    `judgeable=${summary.judgeable}`,
    `worked=${summary.worked}`,
    `invalidated=${summary.invalidated}`,
    `workedRate=${pct(summary.workedRate)}`,
    `total=${r(summary.totalR)}`,
    `maxDD=${r(summary.maxDrawdownR)}`,
    `median=${nullableR(summary.medianR)}`,
    `medianFirst=${nullableR(summary.medianFirstReactionR)}`,
  ].join(" ");
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function r(value: number): string {
  return `${value.toFixed(4).replace(/\.?0+$/, "")}R`;
}

function nullableR(value: number | null): string {
  return value === null ? "n/a" : r(value);
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|");
}

