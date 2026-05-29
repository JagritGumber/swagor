import { join } from "node:path";
import { runReaderReplayReport } from "../packages/strategy-lab/reader-report/run-reader-replay-report";
import { intervalMs, readOrderflowEvents } from "../packages/market-data";
import { analyzeReaderExecutionQuality } from "../packages/strategy-lab/reader-execution-quality/analyze-reader-execution-quality";
import { buildReaderEvidenceReport } from "../packages/strategy-lab/reader-evidence/build-reader-evidence-report";
import { runReaderHistoryReplay } from "../packages/strategy-lab/reader-history/run-reader-history-replay";
import type { CandleInterval, HyperliquidNetwork } from "../packages/market-data";
import type { OrderflowEvent } from "../packages/strategy-lab/orderflow/types";
import type { ReaderExecutionQualityReport } from "../packages/strategy-lab/reader-execution-quality/types";
import type { ReaderEvidenceReport, ReaderTradeDossier } from "../packages/strategy-lab/reader-evidence/types";
import type { ReaderHistoryReplayResult } from "../packages/strategy-lab/reader-history/types";
import type { Candle } from "../packages/strategy-lab/types";

type Venue = "hyperliquid" | "bybit";

type ReportView = ReaderHistoryReplayResult & {
  diagnostics: {
    candleCount: number;
    orderflowEventCount: number;
    firstOrderflowAt: number | null;
    lastOrderflowAt: number | null;
  };
  executionQuality: ReaderExecutionQualityReport;
  evidence: ReaderEvidenceReport;
};

type AssetEvaluation = {
  asset: string;
  status: EvaluationStatus;
  report: ReportView;
  trades: TradeEvaluation[];
  summary: EvaluationSummary;
};

type EvaluationStatus = "OK" | "NO_ORDERFLOW_DATA" | "NO_TRADES" | "UNJUDGEABLE" | "TOO_FEW_TRADES";

type TradeEvaluation = {
  dossier: ReaderTradeDossier;
  trust: boolean;
  trustReason: string;
};

type EvaluationSummary = {
  registeredTrades: number;
  judgeableTrades: number;
  unjudgeableTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
};

type AnalysisGroup = {
  key: string;
  trades: TradeEvaluation[];
  summary: EvaluationSummary;
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseAssets(value: string | undefined, venue: Venue): string[] {
  const fallback = venue === "bybit" ? "BTCUSDT,ETHUSDT,SOLUSDT" : "BTC,ETH,SOL";
  return (value ?? fallback).split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
}

function parseVenue(value: string | undefined): Venue {
  return value === "bybit" ? "bybit" : "hyperliquid";
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

function parseInterval(value: string | undefined): CandleInterval {
  if (value === "1h") return "1h";
  return "5m";
}

const vmUrl = arg("vm-url", process.env.VM_URL ?? "http://localhost:8428")!;
const orderflowRootDir = arg("orderflow-root", process.env.ORDERFLOW_ROOT_DIR ?? "orderflow-data")!;
const venue = parseVenue(arg("venue", process.env.VENUE ?? "hyperliquid"));
const network = parseNetwork(arg("network", process.env.NETWORK ?? "mainnet"));
const assets = parseAssets(arg("assets", process.env.ASSETS), venue);
const interval = parseInterval(arg("interval", process.env.INTERVAL ?? "5m"));
const startMs = parseTimeArg("start", process.env.START_MS, Date.parse("2026-05-27T14:00:00.000Z"));
const endMs = parseTimeArg("end", process.env.END_MS, Date.parse("2026-05-27T22:21:00.000Z"));
const readIntervalMs = Number(arg("read-interval-ms", process.env.READ_INTERVAL_MS ?? "60000"));
const orderflowWindowMs = Number(arg("orderflow-window-ms", process.env.ORDERFLOW_WINDOW_MS ?? "300000"));
const setupTtlMs = Number(arg("setup-ttl-ms", process.env.SETUP_TTL_MS ?? "900000"));
const minCoveragePct = Number(arg("min-coverage-pct", process.env.MIN_COVERAGE_PCT ?? "90"));
const minJudgeableTrades = Number(arg("min-judgeable-trades", process.env.MIN_JUDGEABLE_TRADES ?? "5"));
const tradesLimit = Number(arg("trades-limit", process.env.TRADES_LIMIT ?? "20"));
const dailyLossLimitR = Number(arg("daily-loss-limit-r", process.env.DAILY_LOSS_LIMIT_R ?? "3"));
const summaryOnly = hasFlag("summary-only");

validateInput();

const evaluations: AssetEvaluation[] = [];
for (const asset of assets) {
  evaluations.push(await evaluateAsset(asset));
}

printEvaluation(evaluations);

function parseTimeArg(name: string, envValue: string | undefined, fallback: number): number {
  const raw = arg(name);
  if (raw) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
    throw new Error(`--${name} must be an ISO timestamp or unix milliseconds`);
  }
  if (envValue) {
    const numeric = Number(envValue);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(envValue);
    if (Number.isFinite(parsed)) return parsed;
    throw new Error(`${name.toUpperCase()}_MS must be unix milliseconds or ISO timestamp`);
  }
  return fallback;
}

function validateInput(): void {
  if (assets.length === 0) throw new Error("--assets must include at least one asset");
  if (!Number.isFinite(startMs)) throw new Error("--start must be valid");
  if (!Number.isFinite(endMs)) throw new Error("--end must be valid");
  if (endMs <= startMs) throw new Error("--end must be after --start");
  if (!Number.isFinite(readIntervalMs) || readIntervalMs <= 0) throw new Error("--read-interval-ms must be positive");
  if (!Number.isFinite(orderflowWindowMs) || orderflowWindowMs <= 0) throw new Error("--orderflow-window-ms must be positive");
  if (!Number.isFinite(setupTtlMs) || setupTtlMs <= 0) throw new Error("--setup-ttl-ms must be positive");
  if (!Number.isFinite(minCoveragePct) || minCoveragePct < 0 || minCoveragePct > 100) throw new Error("--min-coverage-pct must be 0..100");
  if (!Number.isFinite(minJudgeableTrades) || minJudgeableTrades < 0) throw new Error("--min-judgeable-trades must be non-negative");
  if (!Number.isFinite(tradesLimit) || tradesLimit < 0) throw new Error("--trades-limit must be non-negative");
  if (!Number.isFinite(dailyLossLimitR) || dailyLossLimitR <= 0) throw new Error("--daily-loss-limit-r must be positive");
}

async function evaluateAsset(asset: string): Promise<AssetEvaluation> {
  const report = venue === "bybit" ? await runBybitReport(asset) : await runHyperliquidReport(asset);
  const trades = report.evidence.trades.map((dossier) => tradeEvaluation(dossier));
  const summary = summarizeTrades(trades);
  return {
    asset,
    report,
    trades,
    summary,
    status: statusFor(report.diagnostics.orderflowEventCount, summary),
  };
}

async function runHyperliquidReport(asset: string): Promise<ReportView> {
  return runReaderReplayReport({
    vmUrl,
    orderflowRootDir,
    network,
    asset,
    interval,
    startMs,
    endMs,
    readIntervalMs,
    orderflowWindowMs,
    setupTtlMs,
  });
}

async function runBybitReport(asset: string): Promise<ReportView> {
  const candleIntervalMs = intervalMs(interval);
  const orderflowEvents = await readBybitOrderflowEvents(asset);
  const candles = candlesFromTrades({ asset, events: orderflowEvents, candleIntervalMs });
  const replay = runReaderHistoryReplay({
    asset,
    interval,
    candleIntervalMs,
    candles,
    orderflowEvents,
    readIntervalMs,
    orderflowWindowMs,
    startAt: startMs,
    endAt: endMs,
    replay: {
      setupConfig: { setupTtlMs },
    },
  });
  const executionQuality = analyzeReaderExecutionQuality({ readIntervalMs, replay });
  return {
    ...replay,
    diagnostics: {
      candleCount: candles.length,
      orderflowEventCount: orderflowEvents.length,
      firstOrderflowAt: firstEventTime(orderflowEvents),
      lastOrderflowAt: lastEventTime(orderflowEvents),
    },
    executionQuality,
    evidence: buildReaderEvidenceReport({
      candles,
      candleIntervalMs,
      readIntervalMs,
      executionQuality,
      replay,
    }),
  };
}

function tradeEvaluation(dossier: ReaderTradeDossier): TradeEvaluation {
  if (dossier.execution.quality === "unusable") {
    return {
      dossier,
      trust: false,
      trustReason: `price coverage ${dossier.execution.coveragePctWhileOpen}% below ${minCoveragePct}% or long unpriced gap`,
    };
  }
  if (dossier.execution.coveragePctWhileOpen < minCoveragePct && dossier.execution.quality !== "open") {
    return {
      dossier,
      trust: false,
      trustReason: `price coverage ${dossier.execution.coveragePctWhileOpen}% below ${minCoveragePct}%`,
    };
  }
  if (dossier.verdict === "open-trade") {
    return {
      dossier,
      trust: false,
      trustReason: "trade still open",
    };
  }
  return {
    dossier,
    trust: true,
    trustReason: "judgeable",
  };
}

function summarizeTrades(trades: TradeEvaluation[]): EvaluationSummary {
  const judgeable = trades.filter((trade) => trade.trust);
  const rValues = judgeable.map((trade) => trade.dossier.trade.r ?? 0);
  return {
    registeredTrades: trades.length,
    judgeableTrades: judgeable.length,
    unjudgeableTrades: trades.length - judgeable.length,
    wins: rValues.filter((r) => r > 0).length,
    losses: rValues.filter((r) => r < 0).length,
    totalR: round(sum(rValues)),
    averageR: rValues.length === 0 ? 0 : round(sum(rValues) / rValues.length),
    maxDrawdownR: round(maxDrawdown(rValues)),
  };
}

function statusFor(orderflowEvents: number, summary: EvaluationSummary): EvaluationStatus {
  if (orderflowEvents === 0) return "NO_ORDERFLOW_DATA";
  if (summary.registeredTrades === 0) return "NO_TRADES";
  if (summary.judgeableTrades === 0) return "UNJUDGEABLE";
  if (summary.judgeableTrades < minJudgeableTrades) return "TOO_FEW_TRADES";
  return "OK";
}

function printEvaluation(evaluations: AssetEvaluation[]): void {
  console.log("ORDERFLOW POC EVALUATION");
  console.log(`venue=${venue} range=${iso(startMs)} -> ${iso(endMs)} assets=${assets.join(",")} interval=${interval}`);
  console.log(`readIntervalMs=${readIntervalMs} orderflowWindowMs=${orderflowWindowMs} minCoveragePct=${minCoveragePct} dailyLossLimitR=${dailyLossLimitR}`);
  console.log("");

  for (const evaluation of evaluations) printAssetEvaluation(evaluation);

  const final = finalSummary(evaluations);
  const guarded = guardedFinalSummary(evaluations);
  console.log("FINAL");
  console.log(`judgeable_trades=${final.judgeableTrades} unjudgeable_trades=${final.unjudgeableTrades} wins=${final.wins} losses=${final.losses} totalR=${formatNumber(final.totalR)} avgR=${formatNumber(final.averageR)} maxDD=${formatNumber(final.maxDrawdownR)}`);
  console.log(`guarded_judgeable=${guarded.summary.judgeableTrades} guarded_skipped=${guarded.skipped} guarded_wins=${guarded.summary.wins} guarded_losses=${guarded.summary.losses} guarded_totalR=${formatNumber(guarded.summary.totalR)} guarded_avgR=${formatNumber(guarded.summary.averageR)} guarded_maxDD=${formatNumber(guarded.summary.maxDrawdownR)}`);
  console.log(`decision=${decisionFor(evaluations, final)}`);
}

function printAssetEvaluation(evaluation: AssetEvaluation): void {
  const diagnostics = evaluation.report.diagnostics;
  console.log(evaluation.asset);
  console.log(`data: candles=${diagnostics.candleCount} orderflow_events=${diagnostics.orderflowEventCount} first_orderflow=${nullableIso(diagnostics.firstOrderflowAt)} last_orderflow=${nullableIso(diagnostics.lastOrderflowAt)} status=${evaluation.status}`);
  printReaderDiagnostics(evaluation.report);
  printResultAnalysis(evaluation.trades);
  if (!summaryOnly) {
    const visibleTrades = tradesLimit === 0 ? evaluation.trades : evaluation.trades.slice(0, tradesLimit);
    console.log("registered:");
    if (evaluation.trades.length === 0) {
      console.log("  none");
    }
    visibleTrades.forEach((trade, index) => printTrade(index + 1, trade));
    if (visibleTrades.length < evaluation.trades.length) {
      console.log(`  ... ${evaluation.trades.length - visibleTrades.length} more hidden by --trades-limit=${tradesLimit}`);
    }
  }
  console.log("summary:");
  console.log(`  registered=${evaluation.summary.registeredTrades} judgeable=${evaluation.summary.judgeableTrades} unjudgeable=${evaluation.summary.unjudgeableTrades} wins=${evaluation.summary.wins} losses=${evaluation.summary.losses} totalR=${formatNumber(evaluation.summary.totalR)} avgR=${formatNumber(evaluation.summary.averageR)} maxDD=${formatNumber(evaluation.summary.maxDrawdownR)}`);
  console.log(`  decision=${assetDecisionFor(evaluation)}`);
  console.log("");
}

function printTrade(index: number, trade: TradeEvaluation): void {
  const dossier = trade.dossier;
  const result = dossier.trade;
  const read = dossier.formation.significantBeforeEntry[dossier.formation.significantBeforeEntry.length - 1];
  const readText = read
    ? `${read.narrative?.intent ?? "no-narrative"}/${read.narrative?.direction ?? "none"} ${read.auction.location} ${read.auction.levelKind ?? "level"} + ${read.orderflow.pressure} + ${read.orderflow.events.join("+") || "no-orderflow-event"}`
    : `${dossier.auction.location} ${dossier.auction.level?.kind ?? "level"} + ${dossier.orderflow.pressure} + ${dossier.orderflow.events.join("+") || "no-orderflow-event"}`;
  console.log(`  ${index}. ${iso(result.entryAt)} ${result.side} family=${result.setupFamily ?? "legacy"} sequence=${result.sequencePhase ?? "n/a"} regime=${result.regime?.mode ?? "unknown"} entry=${formatNumber(result.entryPrice)} stop=${formatNumber(result.stop)} target=${formatNumber(result.target)} exit=${result.exitReason ?? "open"} exitPrice=${formatNullable(result.exitPrice)} r=${formatNullable(result.r)} trust=${trade.trust}`);
  console.log(`     read=${readText}`);
  console.log(`     reason=${trade.trustReason} verdict=${dossier.verdict}`);
}

function printReaderDiagnostics(report: ReportView): void {
  const planStatuses = countBy(report.setupResults, (result) => result.plan.status);
  const setupEvents = countBy(report.setupEvents, (event) => event.type);
  const auctionLocations = countBy(report.historySteps, (step) => step.read.auction.location);
  const orderflowPressure = countBy(report.historySteps, (step) => step.read.orderflow.pressure);
  const narrativeIntents = countBy(report.historySteps, (step) => step.read.narrativeRead?.intent ?? "no-narrative");
  const narrativeParticipation = countBy(report.historySteps, (step) => step.read.narrativeRead?.participation ?? "unknown");
  const topReasons = topCounts(report.setupResults.flatMap((result) => result.plan.reasons), 3);
  console.log(`reader: reads=${report.summary.totalReads} entries_opened=${report.summary.entriesOpened} outcomes=${report.summary.totalOutcomes} open=${report.open ? "yes" : "no"}`);
  console.log(`  plans=${formatCounts(planStatuses)} setup_events=${formatCounts(setupEvents)}`);
  console.log(`  auction=${formatCounts(auctionLocations)} orderflow=${formatCounts(orderflowPressure)}`);
  console.log(`  narrative_intent=${formatCounts(narrativeIntents)} participation=${formatCounts(narrativeParticipation)}`);
  console.log(`  top_no_trade_reasons=${topReasons.length === 0 ? "none" : topReasons.map(([reason, count]) => `${count}x ${reason}`).join(" | ")}`);
}

function printResultAnalysis(trades: TradeEvaluation[]): void {
  const judgeable = trades.filter((trade) => trade.trust);
  console.log("analysis:");
  if (judgeable.length === 0) {
    console.log("  no judgeable trades");
    return;
  }
  printGroups("  by_day", groupedBy(judgeable, dayKey), 10);
  printGroups("  by_regime", groupedBy(judgeable, regimeKey), 8);
  printGroups("  by_setup_family", groupedBy(judgeable, setupFamilyOnlyKey), 8);
  printGroups("  by_setup_family_regime", groupedBy(judgeable, setupFamilyRegimeKey), 10);
  printGroups("  by_sequence", groupedBy(judgeable, sequenceKey), 8);
  printGroups("  by_narrative", groupedBy(judgeable, narrativeKey), 10);
  printGroups("  by_orderflow_evidence", groupedBy(judgeable, orderflowEvidenceKey), 10);
  printGroups("  worst_families", groupedBy(judgeable, setupFamilyKey), 8, "worst");
  printGroups("  best_families", groupedBy(judgeable, setupFamilyKey), 5, "best");
  printGroups("  by_side_location", groupedBy(judgeable, sideLocationKey), 8);
  const guarded = dailyLossGuard(judgeable);
  console.log(`  guarded_summary daily_loss_limit_r=${dailyLossLimitR} skipped=${guarded.skipped} trades=${guarded.summary.judgeableTrades} wins=${guarded.summary.wins} losses=${guarded.summary.losses} totalR=${formatNumber(guarded.summary.totalR)} avgR=${formatNumber(guarded.summary.averageR)} maxDD=${formatNumber(guarded.summary.maxDrawdownR)}`);
  printGroups("  guarded_by_day", groupedBy(guarded.trades, dayKey), 10);
}

function printGroups(
  label: string,
  groups: AnalysisGroup[],
  limit: number,
  order: "natural" | "worst" | "best" = "natural",
): void {
  const sorted = [...groups].sort((left, right) => {
    if (order === "worst") return left.summary.totalR - right.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
    if (order === "best") return right.summary.totalR - left.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
    return left.key.localeCompare(right.key);
  });
  console.log(label);
  for (const group of sorted.slice(0, limit)) {
    console.log(`    ${group.key}: trades=${group.summary.judgeableTrades} wins=${group.summary.wins} losses=${group.summary.losses} totalR=${formatNumber(group.summary.totalR)} avgR=${formatNumber(group.summary.averageR)} maxDD=${formatNumber(group.summary.maxDrawdownR)}`);
  }
}

function groupedBy(trades: TradeEvaluation[], keyFor: (trade: TradeEvaluation) => string): AnalysisGroup[] {
  const groups = new Map<string, TradeEvaluation[]>();
  for (const trade of trades) {
    const key = keyFor(trade);
    const group = groups.get(key);
    if (group) group.push(trade);
    else groups.set(key, [trade]);
  }
  return [...groups.entries()].map(([key, groupTrades]) => ({
    key,
    trades: groupTrades,
    summary: summarizeTrades(groupTrades),
  }));
}

function dailyLossGuard(trades: TradeEvaluation[]): {
  trades: TradeEvaluation[];
  skipped: number;
  summary: EvaluationSummary;
} {
  const dayR = new Map<string, number>();
  const stoppedDays = new Set<string>();
  const kept: TradeEvaluation[] = [];
  let skipped = 0;

  for (const trade of [...trades].sort((a, b) => a.dossier.trade.entryAt - b.dossier.trade.entryAt)) {
    const day = dayKey(trade);
    if (stoppedDays.has(day)) {
      skipped += 1;
      continue;
    }
    kept.push(trade);
    const nextR = (dayR.get(day) ?? 0) + (trade.dossier.trade.r ?? 0);
    dayR.set(day, nextR);
    if (nextR <= -dailyLossLimitR) stoppedDays.add(day);
  }

  return {
    trades: kept,
    skipped,
    summary: summarizeTrades(kept),
  };
}

function dayKey(trade: TradeEvaluation): string {
  return iso(trade.dossier.trade.entryAt).slice(0, 10);
}

function setupFamilyKey(trade: TradeEvaluation): string {
  const read = significantRead(trade);
  const location = read?.auction.location ?? trade.dossier.auction.location;
  const levelKind = read?.auction.levelKind ?? trade.dossier.auction.level?.kind ?? "level";
  const pressure = read?.orderflow.pressure ?? trade.dossier.orderflow.pressure;
  const events = eventFamily(read?.orderflow.events ?? trade.dossier.orderflow.events);
  return `${setupFamilyOnlyKey(trade)}|${trade.dossier.trade.side}|${location}|${levelKind}|${pressure}|${events}`;
}

function setupFamilyOnlyKey(trade: TradeEvaluation): string {
  return trade.dossier.trade.setupFamily ?? "legacy";
}

function regimeKey(trade: TradeEvaluation): string {
  return trade.dossier.trade.regime?.mode ?? "unknown";
}

function setupFamilyRegimeKey(trade: TradeEvaluation): string {
  return `${setupFamilyOnlyKey(trade)}|${regimeKey(trade)}`;
}

function sequenceKey(trade: TradeEvaluation): string {
  return `${setupFamilyOnlyKey(trade)}|${trade.dossier.trade.sequencePhase ?? "n/a"}`;
}

function narrativeKey(trade: TradeEvaluation): string {
  const narrative = trade.dossier.trade.narrative ?? significantRead(trade)?.narrative;
  if (!narrative) return "no-narrative";
  return `${narrative.intent}|${narrative.direction}|${narrative.participation}|${narrative.levelStory}`;
}

function orderflowEvidenceKey(trade: TradeEvaluation): string {
  const orderflow = significantRead(trade)?.orderflow ?? trade.dossier.orderflow;
  const evidence = orderflow.evidence;
  if (!evidence) return "no-evidence";
  return `pressure=${evidence.pressure}|absorption=${evidence.absorption}|print=${evidence.print}|follow=${evidence.followThrough}`;
}

function sideLocationKey(trade: TradeEvaluation): string {
  const read = significantRead(trade);
  const location = read?.auction.location ?? trade.dossier.auction.location;
  const levelKind = read?.auction.levelKind ?? trade.dossier.auction.level?.kind ?? "level";
  return `${trade.dossier.trade.side}|${location}|${levelKind}`;
}

function significantRead(trade: TradeEvaluation) {
  return trade.dossier.formation.significantBeforeEntry[trade.dossier.formation.significantBeforeEntry.length - 1] ?? null;
}

function eventFamily(events: string[]): string {
  const labels: string[] = [];
  if (events.includes("stalled-selling")) labels.push("stalled-selling");
  if (events.includes("stalled-buying")) labels.push("stalled-buying");
  if (events.includes("large-print")) labels.push("large-print");
  if (events.includes("aggressive-absorption")) labels.push("aggressive-absorption");
  if (events.includes("confirmed-absorption")) labels.push("confirmed-absorption");
  if (labels.length === 0 && events.includes("thin-follow-through")) labels.push("thin-follow-through");
  return labels.length === 0 ? "no-event" : labels.join("+");
}

function finalSummary(evaluations: AssetEvaluation[]): EvaluationSummary {
  const trades = evaluations.flatMap((evaluation) => evaluation.trades);
  return summarizeTrades(trades);
}

function guardedFinalSummary(evaluations: AssetEvaluation[]): {
  skipped: number;
  summary: EvaluationSummary;
} {
  const guarded = dailyLossGuard(evaluations.flatMap((evaluation) => evaluation.trades.filter((trade) => trade.trust)));
  return {
    skipped: guarded.skipped,
    summary: guarded.summary,
  };
}

function decisionFor(evaluations: AssetEvaluation[], summary: EvaluationSummary): string {
  if (evaluations.every((evaluation) => evaluation.status === "NO_ORDERFLOW_DATA")) return "COLLECT_MORE_DATA";
  if (summary.judgeableTrades < minJudgeableTrades) return "COLLECT_MORE_DATA";
  if (summary.totalR <= 0 || summary.averageR <= 0) return "KILL";
  if (summary.maxDrawdownR <= -5) return "ADJUST";
  return "CONTINUE";
}

function assetDecisionFor(evaluation: AssetEvaluation): string {
  if (evaluation.status === "NO_ORDERFLOW_DATA") return "COLLECT_MORE_DATA";
  if (evaluation.status === "NO_TRADES") return "ADJUST";
  if (evaluation.status === "UNJUDGEABLE") return "COLLECT_MORE_DATA";
  if (evaluation.status === "TOO_FEW_TRADES") return "COLLECT_MORE_DATA";
  if (evaluation.summary.totalR <= 0 || evaluation.summary.averageR <= 0) return "KILL";
  if (evaluation.summary.maxDrawdownR <= -5) return "ADJUST";
  return "CONTINUE";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function topCounts(items: string[], limit: number): Array<[string, number]> {
  return [...countBy(items, (item) => item).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function formatCounts(counts: Map<string, number>): string {
  if (counts.size === 0) return "none";
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}:${count}`)
    .join(",");
}

function maxDrawdown(rValues: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of rValues) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return maxDd;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : "n/a";
}

function formatNullable(value: number | undefined): string {
  return value === undefined ? "n/a" : formatNumber(value);
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function nullableIso(time: number | null): string {
  return time === null ? "n/a" : iso(time);
}

async function readBybitOrderflowEvents(asset: string): Promise<OrderflowEvent[]> {
  const events: OrderflowEvent[] = [];
  for (const date of dateRange(startMs, endMs)) {
    const path = join(orderflowRootDir, "bybit", "trading", asset.toUpperCase(), `${date}.ndjson`);
    try {
      for (const event of await readOrderflowEvents(path)) {
        events.push(event);
      }
    } catch (error: unknown) {
      if (!isMissingFileError(error)) throw error;
    }
  }
  return events
    .filter((event) => eventTime(event) >= startMs && eventTime(event) <= endMs)
    .sort((a, b) => eventTime(a) - eventTime(b));
}

function candlesFromTrades(input: {
  asset: string;
  events: OrderflowEvent[];
  candleIntervalMs: number;
}): Candle[] {
  const byStart = new Map<number, Candle>();
  for (const event of input.events) {
    if (event.type !== "trade" || event.trade.asset.toUpperCase() !== input.asset.toUpperCase()) continue;
    const start = Math.floor(event.trade.time / input.candleIntervalMs) * input.candleIntervalMs;
    const existing = byStart.get(start);
    if (!existing) {
      byStart.set(start, {
        t: start,
        o: event.trade.price,
        h: event.trade.price,
        l: event.trade.price,
        c: event.trade.price,
        v: event.trade.size,
      });
      continue;
    }
    existing.h = Math.max(existing.h, event.trade.price);
    existing.l = Math.min(existing.l, event.trade.price);
    existing.c = event.trade.price;
    existing.v += event.trade.size;
  }
  return [...byStart.values()].sort((a, b) => a.t - b.t);
}

function firstEventTime(events: OrderflowEvent[]): number | null {
  return events[0] ? eventTime(events[0]) : null;
}

function lastEventTime(events: OrderflowEvent[]): number | null {
  const last = events[events.length - 1];
  return last ? eventTime(last) : null;
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.receivedAt;
}

function dateRange(start: number, end: number): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (current.getTime() <= last.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}
