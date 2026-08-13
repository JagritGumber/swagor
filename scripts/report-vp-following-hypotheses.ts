import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildReaderHypothesisScoreReport,
  defaultReaderHypotheses,
  type ReaderCandidate,
  type ReaderCandidateTape,
  type ReaderHypothesis,
  type ReaderHypothesisScoreReport,
  type ReaderHypothesisScoreResult,
} from "../packages/strategy-lab";

type CandidateTapeFile = {
  assets: Array<{
    asset: string;
    tape: ReaderCandidateTape;
  }>;
};

type SlimResult = Omit<ReaderHypothesisScoreResult, "hypothesis"> & {
  hypothesis: Pick<ReaderHypothesis, "id" | "label" | "description" | "kind" | "filters" | "confirmation">;
};

type SlimReport = Omit<ReaderHypothesisScoreReport, "ranked"> & {
  ranked: SlimResult[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = parseList(arg("tapes"));
const out = arg("out", "artifacts/vp-following-hypotheses-score.md");
const label = arg("label", "vp-following") ?? "vp-following";
const roundTripCostBps = numberArg("round-trip-cost-bps", 1);
const bootstrapSamples = positiveInteger(arg("bootstrap-samples", "1000"), "--bootstrap-samples");
const bootstrapSeed = positiveInteger(arg("bootstrap-seed", "42"), "--bootstrap-seed");
const bootstrapPercentile = percentileArg(arg("bootstrap-percentile", "0.05"), "--bootstrap-percentile");
const hypothesisIds = parseList(arg("hypothesis-ids"));

if (tapePaths.length === 0) throw new Error("--tapes must include one or more candidate-tape JSON paths");

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const files = await Promise.all(tapePaths.map(readTape));
  const candidates = dedupeCandidates(files.flatMap((file) => file.assets.flatMap((asset) => asset.tape.candidates)));

  console.log(`Loaded ${candidates.length} candidates from ${tapePaths.length} tapes`);

  const vpHypothesisIds = [
    "long-no-vp-bear-poc-stable-value-stable",
    "long-no-vp-bear-poc-migrate-up",
    "short-no-vp-bull-poc-stable-value-stable",
    "short-no-vp-bull-poc-migrate-down",
    "long-absorption-poc-migrate-up",
    "short-absorption-poc-migrate-down",
    "long-tight-inv-2-3-bps",
    "short-tight-inv-2-3-bps",
  ];

  const originalIds = hypothesisIds.length > 0 ? hypothesisIds : [
    "vp-active-long-first-reaction-nonnegative",
    "vp-trend-down-active-price-follow-025",
    "vp-confirmed-absorption-trend-down-price-follow-025",
    "trend-pullback-continuation-price-follow-025",
    "trend-pullback-long-thin-immediate",
  ];

  const allIds = [...originalIds, ...vpHypothesisIds];
  const hypotheses = selectHypotheses(allIds);

  console.log(`Evaluating ${hypotheses.length} hypotheses (${originalIds.length} original + ${vpHypothesisIds.length} VP-following)`);

  const report = buildReaderHypothesisScoreReport({
    candidates,
    hypotheses,
    options: {
      roundTripCostBps,
      bootstrapSamples,
      bootstrapSeed,
      bootstrapPercentile,
    },
  });

  const slim = slimReport(report);
  printReport(label, slim);
  if (out) await writeReport(out, label, slim);
}

function selectHypotheses(ids: string[]): ReaderHypothesis[] {
  const selected = defaultReaderHypotheses.filter((hypothesis) => ids.includes(hypothesis.id));
  const missing = ids.filter((id) => !selected.some((hypothesis) => hypothesis.id === id));
  if (missing.length > 0) throw new Error(`Unknown hypothesis ids: ${missing.join(", ")}`);
  return selected;
}

function slimReport(report: ReaderHypothesisScoreReport): SlimReport {
  return {
    summary: report.summary,
    ranked: report.ranked.map((result) => ({
      ...result,
      hypothesis: {
        id: result.hypothesis.id,
        label: result.hypothesis.label,
        description: result.hypothesis.description,
        kind: result.hypothesis.kind,
        filters: result.hypothesis.filters,
        confirmation: result.hypothesis.confirmation,
      },
    })),
  };
}

function printReport(reportLabel: string, report: SlimReport): void {
  console.log(`\nREADER HYPOTHESIS SCORE ${reportLabel}`);
  console.log(`candidates=${report.summary.candidates} hypotheses=${report.summary.hypotheses} evaluatedDays=${report.summary.evaluatedDays} roundTripCostBps=${report.summary.roundTripCostBps}`);
  console.log(`bootstrap=${report.summary.bootstrapSamples} samples seed=${report.summary.bootstrapSeed} percentile=${report.summary.bootstrapPercentile}`);
  console.log("");
  console.log("RANKED HYPOTHESES:");
  for (const result of report.ranked) {
    const isVp = result.hypothesis.id.startsWith("vp-") && !originalIds().includes(result.hypothesis.id);
    const marker = isVp ? " [VP-FOLLOWING]" : "";
    console.log(`${result.hypothesis.id}${marker}`);
    console.log(`  tier=${result.paretoTier} rank=${result.aggregateRank} entries=${result.path.entries} total=${r(result.path.totalR)} rDay=${r(result.path.rPerEvaluatedDay)} win=${pct(result.path.winRate)} maxDD=${r(result.path.maxDrawdownR)} bootP=${pct(result.bootstrap.positiveReturnProbability)}`);
  }
}

function originalIds(): string[] {
  return [
    "vp-active-long-first-reaction-nonnegative",
    "vp-trend-down-active-price-follow-025",
    "vp-confirmed-absorption-trend-down-price-follow-025",
    "trend-pullback-continuation-price-follow-025",
    "trend-pullback-long-thin-immediate",
  ];
}

async function writeReport(path: string, reportLabel: string, report: SlimReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(reportLabel, report), "utf8");
  console.log(`\nreport=${path}`);
}

function markdownFor(reportLabel: string, report: SlimReport): string {
  const vpResults = report.ranked.filter((r) => r.hypothesis.id.startsWith("vp-") && !originalIds().includes(r.hypothesis.id));
  const origResults = report.ranked.filter((r) => !vpResults.includes(r));

  return [
    `# VP-Following Hypotheses: ${reportLabel}`,
    "",
    `Candidates: ${report.summary.candidates}`,
    `Hypotheses: ${report.summary.hypotheses}`,
    `Evaluated days: ${report.summary.evaluatedDays}`,
    `Round-trip cost: ${report.summary.roundTripCostBps}bps`,
    `Bootstrap: ${report.summary.bootstrapSamples} samples, seed ${report.summary.bootstrapSeed}, percentile ${report.summary.bootstrapPercentile}`,
    "",
    "## Original Hypotheses (Baseline)",
    "",
    "| Hypothesis | Tier | Rank | Entries | Total R | R/Day | Win | Max DD | Boot Positive |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...origResults.map(resultRow),
    "",
    "## VP-Following Hypotheses (New)",
    "",
    "| Hypothesis | Tier | Rank | Entries | Total R | R/Day | Win | Max DD | Boot Positive |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...vpResults.map(resultRow),
    "",
    "## All Ranked",
    "",
    "| Hypothesis | Kind | Tier | Rank | Entries | Total R | R/Day | Win | Max DD | Boot Positive |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.ranked.map(resultRowFull),
    "",
  ].join("\n");
}

function resultRow(result: SlimResult): string {
  return [
    result.hypothesis.id,
    result.paretoTier,
    result.aggregateRank,
    result.path.entries,
    r(result.path.totalR),
    r(result.path.rPerEvaluatedDay),
    pct(result.path.winRate),
    r(result.path.maxDrawdownR),
    pct(result.bootstrap.positiveReturnProbability),
  ].map((value) => escapeTable(String(value))).join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function resultRowFull(result: SlimResult): string {
  return [
    result.hypothesis.id,
    result.hypothesis.kind,
    result.paretoTier,
    result.aggregateRank,
    result.path.entries,
    r(result.path.totalR),
    r(result.path.rPerEvaluatedDay),
    pct(result.path.winRate),
    r(result.path.maxDrawdownR),
    pct(result.bootstrap.positiveReturnProbability),
  ].map((value) => escapeTable(String(value))).join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

async function readTape(path: string): Promise<CandidateTapeFile> {
  return JSON.parse(await readFile(path, "utf8")) as CandidateTapeFile;
}

function dedupeCandidates(candidates: ReaderCandidate[]): ReaderCandidate[] {
  const seen = new Set<string>();
  const deduped: ReaderCandidate[] = [];
  for (const candidate of candidates) {
    const key = [
      candidate.asset,
      candidate.observedAt,
      candidate.family,
      candidate.side ?? "none",
      round(candidate.entryPrice),
      round(candidate.target),
      round(candidate.invalidation),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative number`);
  return parsed;
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function percentileArg(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1`);
  return parsed;
}

function r(value: number): string {
  return `${round(value)}R`;
}

function pct(value: number): string {
  return `${round(value * 100)}%`;
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function round(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  return Math.round(value * 10_000) / 10_000;
}
