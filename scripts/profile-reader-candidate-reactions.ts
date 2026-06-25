import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  profileReaderCandidateReactions,
  type ReaderCandidate,
  type ReaderCandidateReactionBucket,
  type ReaderCandidateReactionFilter,
  type ReaderCandidateReactionProfile,
  type ReaderCandidateReactionSummary,
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
const buckets = positiveInteger(arg("buckets", "4"), "--buckets");
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
const profile = profileReaderCandidateReactions({ candidates, filter, buckets });

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

function printProfile(profile: ReaderCandidateReactionProfile): void {
  console.log("READER CANDIDATE REACTION PROFILE");
  console.log(`filter=${JSON.stringify(profile.filter)}`);
  console.log(`summary ${summaryLine(profile.summary)}`);
  for (const bucket of profile.reactionBuckets) {
    console.log(`${bucket.key} firstReactionR=${nullableR(bucket.minFirstReactionR)}..${nullableR(bucket.maxFirstReactionR)} ${summaryLine(bucket.summary)}`);
  }
}

async function writeProfile(path: string, profile: ReaderCandidateReactionProfile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(profile), "utf8");
  console.log(`candidate_reaction_profile=${path}`);
}

function markdownFor(profile: ReaderCandidateReactionProfile): string {
  return [
    "# Reader Candidate Reaction Profile",
    "",
    "## Filter",
    "",
    "```json",
    JSON.stringify(profile.filter, null, 2),
    "```",
    "",
    "## Summary",
    "",
    summaryBlock(profile.summary),
    "## First-Reaction R Buckets",
    "",
    "| Bucket | First Reaction R | Candidates | Worked/Invalidated | Worked Rate | Total R | Max DD | Min Equity | Median R | Median First Reaction R | Median Target R | Median Invalidation Bps |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...profile.reactionBuckets.map(bucketRow),
    "",
    ...profile.reactionBuckets.map(bucketDetails),
  ].join("\n");
}

function bucketRow(bucket: ReaderCandidateReactionBucket): string {
  return [
    bucket.key,
    `${nullableR(bucket.minFirstReactionR)}..${nullableR(bucket.maxFirstReactionR)}`,
    bucket.summary.candidates,
    `${bucket.summary.worked}/${bucket.summary.invalidated}`,
    pct(bucket.summary.workedRate),
    r(bucket.summary.totalR),
    r(bucket.summary.maxDrawdownR),
    r(bucket.summary.minEquityR),
    nullableR(bucket.summary.medianR),
    nullableR(bucket.summary.medianFirstReactionR),
    nullableR(bucket.summary.medianTargetR),
    nullableBps(bucket.summary.medianInvalidationBps),
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function bucketDetails(bucket: ReaderCandidateReactionBucket): string {
  return [
    `### ${bucket.key}`,
    "",
    `Refs: ${bucket.refs.join(", ")}`,
    "",
  ].join("\n");
}

function summaryBlock(summary: ReaderCandidateReactionSummary): string {
  return [
    `Candidates: ${summary.candidates}`,
    `Judgeable: ${summary.judgeable}`,
    `Worked/Invalidated: ${summary.worked}/${summary.invalidated}`,
    `Worked rate: ${pct(summary.workedRate)}`,
    `Total R: ${r(summary.totalR)}`,
    `Max drawdown R: ${r(summary.maxDrawdownR)}`,
    `Min equity R: ${r(summary.minEquityR)}`,
    `Average R: ${nullableR(summary.averageR)}`,
    `Median R: ${nullableR(summary.medianR)}`,
    `Average first reaction R: ${nullableR(summary.averageFirstReactionR)}`,
    `Median first reaction R: ${nullableR(summary.medianFirstReactionR)}`,
    `Average target R: ${nullableR(summary.averageTargetR)}`,
    `Median target R: ${nullableR(summary.medianTargetR)}`,
    `Average invalidation bps: ${nullableBps(summary.averageInvalidationBps)}`,
    `Median invalidation bps: ${nullableBps(summary.medianInvalidationBps)}`,
    "",
  ].join("\n");
}

function summaryLine(summary: ReaderCandidateReactionSummary): string {
  return [
    `candidates=${summary.candidates}`,
    `judgeable=${summary.judgeable}`,
    `worked=${summary.worked}`,
    `invalidated=${summary.invalidated}`,
    `workedRate=${pct(summary.workedRate)}`,
    `total=${r(summary.totalR)}`,
    `maxDD=${r(summary.maxDrawdownR)}`,
    `minEquity=${r(summary.minEquityR)}`,
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

function nullableBps(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(4).replace(/\.?0+$/, "")}bps`;
}

