import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buildReaderHypothesisMonteCarloReport,
  defaultReaderHypotheses,
  type ReaderCandidate,
  type ReaderCandidateTape,
  type ReaderHypothesis,
  type ReaderHypothesisMonteCarloPathStats,
  type ReaderHypothesisMonteCarloReport,
  type ReaderHypothesisMonteCarloResult,
} from "../packages/strategy-lab";

type CandidateTapeFile = {
  assets: Array<{
    asset: string;
    tape: ReaderCandidateTape;
  }>;
};

type SlimResult = Omit<ReaderHypothesisMonteCarloResult, "hypothesis"> & {
  hypothesis: Pick<ReaderHypothesis, "id" | "label" | "description" | "kind" | "filters" | "confirmation">;
};

type SlimReport = Omit<ReaderHypothesisMonteCarloReport, "ranked"> & {
  ranked: SlimResult[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const tapePaths = parseList(arg("tapes"));
const out = arg("out", "artifacts/vp-following-monte-carlo.md");
const label = arg("label", "vp-following-monte-carlo") ?? "vp-following-monte-carlo";
const roundTripCostBps = nonNegativeNumberArg("round-trip-cost-bps", 1);
const samples = positiveInteger(arg("samples", "10000"), "--samples");
const seed = integerArg("seed", 42);
const percentile = percentileArg(arg("percentile", "0.05"), "--percentile");
const ruinDrawdownR = negativeNumberArg("ruin-drawdown-r", -25);

if (tapePaths.length === 0) throw new Error("--tapes must include one or more candidate-tape JSON paths");

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const files = await Promise.all(tapePaths.map(readTape));
  const candidates = dedupeCandidates(files.flatMap((file) => file.assets.flatMap((asset) => asset.tape.candidates)));

  console.log(`Loaded ${candidates.length} candidates`);

  const hypothesisIds = [
    "long-no-vp-bear-poc-stable-value-stable",
    "long-tight-inv-2-3-bps",
    "short-tight-inv-2-3-bps",
    "long-absorption-poc-migrate-up",
    "vp-trend-down-active-price-follow-025",
    "vp-active-long-first-reaction-nonnegative",
  ];

  const hypotheses = selectHypotheses(hypothesisIds);
  console.log(`Running Monte Carlo on ${hypotheses.length} hypotheses with ${samples} samples`);

  const report = buildReaderHypothesisMonteCarloReport({
    candidates,
    hypotheses,
    options: {
      roundTripCostBps,
      samples,
      seed,
      percentile,
      ruinDrawdownR,
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

function slimReport(report: ReaderHypothesisMonteCarloReport): SlimReport {
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
  console.log(`\nREADER HYPOTHESIS MONTE CARLO ${reportLabel}`);
  console.log(`candidates=${report.summary.candidates} hypotheses=${report.summary.hypotheses} samples=${report.summary.samples} seed=${report.summary.seed}`);
  console.log(`ruinDrawdownR=${r(report.summary.ruinDrawdownR)} roundTripCostBps=${report.summary.roundTripCostBps}`);
  console.log("");
  for (const result of report.ranked) {
    console.log(`${result.hypothesis.id}`);
    console.log(`  entries=${result.entries} days=${result.evaluatedDays} total=${r(result.summary.totalR)} maxDD=${r(result.summary.maxDrawdownR)}`);
    console.log(`  tradeP05=${r(result.tradeOrder.totalRP05)} tradeDDP05=${r(result.tradeOrder.maxDrawdownP05R)} tradeRuin=${pct(result.tradeOrder.ruinProbability)}`);
    console.log(`  dayP05=${r(result.dayBlock.totalRP05)} dayDDP05=${r(result.dayBlock.maxDrawdownP05R)} dayRuin=${pct(result.dayBlock.ruinProbability)} dayPositive=${pct(result.dayBlock.positiveReturnProbability)}`);
  }
}

async function writeReport(path: string, reportLabel: string, report: SlimReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path.replace(/\.md$/i, ".json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path, markdownFor(reportLabel, report), "utf8");
  console.log(`\nreport=${path}`);
}

function markdownFor(reportLabel: string, report: SlimReport): string {
  return [
    `# VP-Following Monte Carlo: ${reportLabel}`,
    "",
    `Candidates: ${report.summary.candidates}`,
    `Hypotheses: ${report.summary.hypotheses}`,
    `Round-trip cost: ${report.summary.roundTripCostBps}bps`,
    `Samples: ${report.summary.samples}`,
    `Seed: ${report.summary.seed}`,
    `Percentile: ${report.summary.percentile}`,
    `Ruin drawdown: ${r(report.summary.ruinDrawdownR)}`,
    "",
    "> Trade-order resamples individual trades. Day-block resamples calendar-day PnL, including no-trade days as 0R, so it keeps clustering risk closer to the real path.",
    "",
    "| Hypothesis | Entries | Days | W/L | Total R | Max DD | Trade Total P05 | Trade DD P05 | Trade Ruin | Day Total P05 | Day DD P05 | Day Ruin | Day Positive |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.ranked.map(resultRow),
    "",
  ].join("\n");
}

function resultRow(result: SlimResult): string {
  return [
    result.hypothesis.id,
    result.entries,
    result.evaluatedDays,
    `${result.summary.worked}/${result.summary.invalidated}`,
    r(result.summary.totalR),
    r(result.summary.maxDrawdownR),
    r(result.tradeOrder.totalRP05),
    r(result.tradeOrder.maxDrawdownP05R),
    pct(result.tradeOrder.ruinProbability),
    r(result.dayBlock.totalRP05),
    r(result.dayBlock.maxDrawdownP05R),
    pct(result.dayBlock.ruinProbability),
    pct(result.dayBlock.positiveReturnProbability),
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

function nonNegativeNumberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative number`);
  return parsed;
}

function negativeNumberArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed >= 0) throw new Error(`--${name} must be a negative number`);
  return parsed;
}

function integerArg(name: string, fallback: number): number {
  const value = arg(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) throw new Error(`--${name} must be a finite integer`);
  return parsed;
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function percentileArg(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.5) throw new Error(`${name} must be between 0 and 0.5`);
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
