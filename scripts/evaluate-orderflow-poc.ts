import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runReaderReplayReport } from "../packages/strategy-lab/reader-report/run-reader-replay-report";
import { intervalMs, readOrderflowBuckets, readOrderflowEvents } from "../packages/market-data";
import { analyzeReaderExecutionQuality } from "../packages/strategy-lab/reader-execution-quality/analyze-reader-execution-quality";
import { buildReaderEvidenceReport } from "../packages/strategy-lab/reader-evidence/build-reader-evidence-report";
import { buildReaderCandidateTape } from "../packages/strategy-lab/reader-candidates/build-reader-candidate-tape";
import { analyzeReaderTrades, summarizeReaderTrades } from "../packages/strategy-lab/reader-analysis/analyze-reader-trades";
import { runReaderHistoryReplay } from "../packages/strategy-lab/reader-history/run-reader-history-replay";
import { createReaderNarrativeStateMemory } from "../packages/strategy-lab/reader-narrative-state/create-reader-narrative-state-memory";
import { createReaderRadarMemory } from "../packages/strategy-lab/reader-radar/create-reader-radar-memory";
import { createReaderResultState } from "../packages/strategy-lab/reader-result/create-reader-result-state";
import { createReaderSetupMemory } from "../packages/strategy-lab/reader-setup/create-reader-setup-memory";
import { summarizeReaderOutcomes } from "../packages/strategy-lab/reader-replay/summarize-reader-outcomes";
import type { CandleInterval, HyperliquidNetwork } from "../packages/market-data";
import type { OrderflowBucket } from "../packages/market-data";
import type { OrderflowEvent } from "../packages/strategy-lab/read-core/orderflow/types";
import type { ReaderExecutionQualityReport } from "../packages/strategy-lab/reader-execution-quality/types";
import type { ReaderEvidenceReport } from "../packages/strategy-lab/reader-evidence/types";
import type { ReaderAnalyzedTrade, ReaderAnalysisGroup, ReaderAnalysisReport, ReaderAnalysisSummary } from "../packages/strategy-lab/reader-analysis/types";
import type { ReaderHistoryReplayResult } from "../packages/strategy-lab/reader-history/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome, ReaderResultUpdate } from "../packages/strategy-lab/reader-result/types";
import type { ReaderSetupEvent, ReaderSetupResult } from "../packages/strategy-lab/reader-setup/types";
import type { ReaderNarrativeSessionMode } from "../packages/strategy-lab/reader-narrative-state/types";
import type { ReaderRadarConfig, ReaderRadarEvent, ReaderRadarUpdate } from "../packages/strategy-lab/reader-radar/types";
import { READER_ABSORPTION_POLICIES, type ReaderAbsorptionPolicy } from "../packages/strategy-lab/reader-absorption-quality/types";
import type { Candle } from "../packages/strategy-lab/types";

type Venue = "hyperliquid" | "bybit";
type DataMode = "raw" | "parquet";
type BucketEventMode = "split" | "aggregate";
type ReaderRadarArg = "off" | "shadow" | "execute";
type TradeStyle =
  | "all"
  | "reversal-only"
  | "trend-only"
  | "trend-breakout-only"
  | "trend-pullback-only"
  | "trend-long-pullback-only"
  | "trend-short-pullback-only";

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
  analysis: ReaderAnalysisReport;
  trades: ReaderAnalyzedTrade[];
  summary: ReaderAnalysisSummary;
};

type EvaluationStatus = "OK" | "NO_ORDERFLOW_DATA" | "NO_TRADES" | "UNJUDGEABLE" | "TOO_FEW_TRADES";

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

function parseDataMode(value: string | undefined): DataMode {
  return value === "parquet" ? "parquet" : "raw";
}

function parseBucketEventMode(value: string | undefined): BucketEventMode {
  return value === "aggregate" ? "aggregate" : "split";
}

function parseNarrativeSessionMode(value: string | undefined): ReaderNarrativeSessionMode {
  if (value === "rolling" || value === "liquidity-session") return value;
  return "utc-day";
}

function parseReaderRadar(value: string | undefined): ReaderRadarArg {
  if (value === "shadow" || value === "execute") return value;
  return "off";
}

function parseTradeStyle(value: string | undefined): TradeStyle {
  if (
    value === "reversal-only"
    || value === "trend-only"
    || value === "trend-breakout-only"
    || value === "trend-pullback-only"
    || value === "trend-long-pullback-only"
    || value === "trend-short-pullback-only"
  ) return value;
  return "all";
}

function parseAbsorptionPolicy(value: string | undefined): ReaderAbsorptionPolicy {
  if (value && READER_ABSORPTION_POLICIES.includes(value as ReaderAbsorptionPolicy)) return value as ReaderAbsorptionPolicy;
  return "strict-trap";
}

const vmUrl = arg("vm-url", process.env.VM_URL ?? "http://localhost:8428")!;
const orderflowRootDir = arg("orderflow-root", process.env.ORDERFLOW_ROOT_DIR ?? "orderflow-data")!;
const marketStoreRoot = arg("market-store-root", process.env.MARKET_STORE_ROOT ?? "market-store")!;
const venue = parseVenue(arg("venue", process.env.VENUE ?? "hyperliquid"));
const dataMode = parseDataMode(arg("data-mode", process.env.DATA_MODE ?? "raw"));
const bucketEventMode = parseBucketEventMode(arg("bucket-event-mode", process.env.BUCKET_EVENT_MODE ?? "split"));
const narrativeSessionMode = parseNarrativeSessionMode(arg("narrative-session-mode", process.env.NARRATIVE_SESSION_MODE ?? "utc-day"));
const readerRadar = parseReaderRadar(arg("reader-radar", process.env.READER_RADAR ?? "off"));
const tradeStyle = parseTradeStyle(arg("trade-style", process.env.TRADE_STYLE ?? "all"));
const absorptionPolicy = parseAbsorptionPolicy(arg("absorption-policy", process.env.ABSORPTION_POLICY ?? "strict-trap"));
const network = parseNetwork(arg("network", process.env.NETWORK ?? "mainnet"));
const assets = parseAssets(arg("assets", process.env.ASSETS), venue);
const interval = parseInterval(arg("interval", process.env.INTERVAL ?? "5m"));
const startMs = parseTimeArg("start", process.env.START_MS, Date.parse("2026-05-27T14:00:00.000Z"));
const endMs = parseTimeArg("end", process.env.END_MS, Date.parse("2026-05-27T22:21:00.000Z"));
const readIntervalMs = Number(arg("read-interval-ms", process.env.READ_INTERVAL_MS ?? "60000"));
const orderflowWindowMs = Number(arg("orderflow-window-ms", process.env.ORDERFLOW_WINDOW_MS ?? "300000"));
const setupTtlMs = Number(arg("setup-ttl-ms", process.env.SETUP_TTL_MS ?? "900000"));
const readerRadarMaxStaleMs = optionalPositiveNumber(arg("reader-radar-max-stale-ms", process.env.READER_RADAR_MAX_STALE_MS), "--reader-radar-max-stale-ms");
const minCoveragePct = Number(arg("min-coverage-pct", process.env.MIN_COVERAGE_PCT ?? "90"));
const minJudgeableTrades = Number(arg("min-judgeable-trades", process.env.MIN_JUDGEABLE_TRADES ?? "5"));
const tradesLimit = Number(arg("trades-limit", process.env.TRADES_LIMIT ?? "20"));
const dailyLossLimitR = Number(arg("daily-loss-limit-r", process.env.DAILY_LOSS_LIMIT_R ?? "3"));
const riskPct = Number(arg("risk-pct", process.env.RISK_PCT ?? "0.25"));
const feePct = Number(arg("fee-pct", process.env.FEE_PCT ?? "0"));
const slippagePct = Number(arg("slippage-pct", process.env.SLIPPAGE_PCT ?? "0"));
const initialCapital = optionalPositiveNumber(arg("initial-capital", process.env.INITIAL_CAPITAL), "--initial-capital");
const auctionLevelCandles = optionalPositiveNumber(arg("auction-level-candles", process.env.AUCTION_LEVEL_CANDLES), "--auction-level-candles");
const profileTradeSampleLimit = optionalPositiveNumber(arg("profile-trade-sample-limit", process.env.PROFILE_TRADE_SAMPLE_LIMIT), "--profile-trade-sample-limit");
const localRangeCandles = optionalPositiveNumber(arg("local-range-candles", process.env.LOCAL_RANGE_CANDLES), "--local-range-candles");
const tradeTapeOut = arg("trade-tape-out", process.env.TRADE_TAPE_OUT);
const candidateTapeOut = arg("candidate-tape-out", process.env.CANDIDATE_TAPE_OUT);
const radarEventsOut = arg("radar-events-out", process.env.RADAR_EVENTS_OUT);
const summaryOnly = hasFlag("summary-only");
const chunkMonths = hasFlag("chunk-months");
const chunkDays = hasFlag("chunk-days");
const includeFormationTransition = hasFlag("include-formation-transition");

validateInput();

const evaluations: AssetEvaluation[] = [];
for (const asset of assets) {
  evaluations.push(await evaluateAsset(asset));
}

printEvaluation(evaluations);
await writeTradeTapeIfRequested(evaluations);
await writeCandidateTapeIfRequested(evaluations);
await writeRadarEventsIfRequested(evaluations);

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

function optionalPositiveNumber(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive finite number`);
  return parsed;
}

function auctionConfig(): { levelCandles?: number; profileTradeSampleLimit?: number; localRangeCandles?: number } | undefined {
  if (auctionLevelCandles === undefined && profileTradeSampleLimit === undefined && localRangeCandles === undefined) return undefined;
  return {
    ...(auctionLevelCandles === undefined ? {} : { levelCandles: auctionLevelCandles }),
    ...(profileTradeSampleLimit === undefined ? {} : { profileTradeSampleLimit }),
    ...(localRangeCandles === undefined ? {} : { localRangeCandles }),
  };
}

function tradePlanConfig() {
  return { tradeStyle };
}

function readerRadarConfig(): ReaderRadarConfig | undefined {
  if (readerRadar === "off") return undefined;
  return {
    mode: readerRadar,
    maxStaleMs: readerRadarMaxStaleMs ?? null,
    tradeStyle,
  };
}

function validateInput(): void {
  if (assets.length === 0) throw new Error("--assets must include at least one asset");
  if (!Number.isFinite(startMs)) throw new Error("--start must be valid");
  if (!Number.isFinite(endMs)) throw new Error("--end must be valid");
  if (endMs <= startMs) throw new Error("--end must be after --start");
  if (!Number.isFinite(readIntervalMs) || readIntervalMs <= 0) throw new Error("--read-interval-ms must be positive");
  if (!Number.isFinite(orderflowWindowMs) || orderflowWindowMs <= 0) throw new Error("--orderflow-window-ms must be positive");
  if (!Number.isFinite(setupTtlMs) || setupTtlMs <= 0) throw new Error("--setup-ttl-ms must be positive");
  if (readerRadar === "execute" && readerRadarMaxStaleMs === undefined) throw new Error("--reader-radar=execute requires explicit --reader-radar-max-stale-ms");
  if (!Number.isFinite(minCoveragePct) || minCoveragePct < 0 || minCoveragePct > 100) throw new Error("--min-coverage-pct must be 0..100");
  if (!Number.isFinite(minJudgeableTrades) || minJudgeableTrades < 0) throw new Error("--min-judgeable-trades must be non-negative");
  if (!Number.isFinite(tradesLimit) || tradesLimit < 0) throw new Error("--trades-limit must be non-negative");
  if (!Number.isFinite(dailyLossLimitR) || dailyLossLimitR <= 0) throw new Error("--daily-loss-limit-r must be positive");
  if (!Number.isFinite(riskPct) || riskPct <= 0) throw new Error("--risk-pct must be positive");
  if (!Number.isFinite(feePct) || feePct < 0) throw new Error("--fee-pct must be non-negative");
  if (!Number.isFinite(slippagePct) || slippagePct < 0) throw new Error("--slippage-pct must be non-negative");
}

async function evaluateAsset(asset: string): Promise<AssetEvaluation> {
  const report = venue === "bybit" ? await runBybitReport(asset) : await runHyperliquidReport(asset);
  const analysis = analyzeReaderTrades({
    trades: report.evidence.trades,
    minCoveragePct,
    dailyLossLimitR,
    riskPct,
    feePct,
    slippagePct,
    initialCapital,
  });
  return {
    asset,
    report,
    analysis,
    trades: analysis.trades,
    summary: analysis.summary,
    status: statusFor(report.diagnostics.orderflowEventCount, analysis.summary),
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
  if (dataMode === "parquet" && (chunkMonths || chunkDays)) return runBybitChunkedParquetReport(asset);
  const candleIntervalMs = intervalMs(interval);
  const data = dataMode === "parquet"
    ? await readBybitCompactOrderflow(asset, candleIntervalMs)
    : await readBybitRawOrderflow(asset, candleIntervalMs);
  const { candles, orderflowEvents } = data;
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
      auctionConfig: auctionConfig(),
      readerConfig: { absorptionPolicy },
      replay: {
        radarConfig: readerRadarConfig(),
        setupConfig: {
          tradePlanConfig: tradePlanConfig(),
          setupTtlMs,
          narrativeState: { sessionMode: narrativeSessionMode },
        },
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

function statusFor(orderflowEvents: number, summary: ReaderAnalysisSummary): EvaluationStatus {
  if (orderflowEvents === 0) return "NO_ORDERFLOW_DATA";
  if (summary.registeredTrades === 0) return "NO_TRADES";
  if (summary.judgeableTrades === 0) return "UNJUDGEABLE";
  if (summary.judgeableTrades < minJudgeableTrades) return "TOO_FEW_TRADES";
  return "OK";
}

function printEvaluation(evaluations: AssetEvaluation[]): void {
  console.log("ORDERFLOW POC EVALUATION");
  console.log(`venue=${venue} dataMode=${dataMode} bucketEventMode=${bucketEventMode} narrativeSessionMode=${narrativeSessionMode} readerRadar=${readerRadar} readerRadarMaxStaleMs=${readerRadarMaxStaleMs ?? "off"} tradeStyle=${tradeStyle} absorptionPolicy=${absorptionPolicy} auctionLevelCandles=${auctionLevelCandles ?? "all"} profileTradeSampleLimit=${profileTradeSampleLimit ?? "default"} localRangeCandles=${localRangeCandles ?? "auto"} range=${iso(startMs)} -> ${iso(endMs)} assets=${assets.join(",")} interval=${interval}`);
  console.log(`readIntervalMs=${readIntervalMs} orderflowWindowMs=${orderflowWindowMs} minCoveragePct=${minCoveragePct} dailyLossLimitR=${dailyLossLimitR}`);
  console.log(`riskPct=${riskPct} feePct=${feePct} slippagePct=${slippagePct} initialCapital=${initialCapital ?? "off"}`);
  console.log("");

  for (const evaluation of evaluations) printAssetEvaluation(evaluation);

  const final = finalSummary(evaluations);
  const guarded = guardedFinalSummary(evaluations);
  console.log("FINAL");
  console.log(`judgeable_trades=${final.judgeableTrades} unjudgeable_trades=${final.unjudgeableTrades} wins=${final.wins} losses=${final.losses} totalR=${formatNumber(final.totalR)} avgR=${formatNumber(final.averageR)} maxDD=${formatNumber(final.maxDrawdownR)} maxDDFrom=${final.maxDrawdownFrom} maxDDAt=${final.maxDrawdownAt} minEquity=${formatNumber(final.minEquityR)} minEquityAt=${final.minEquityAt} returnPct=${formatNumber(final.returnPct)} maxDDPct=${formatNumber(final.maxDrawdownPct)} minEquityPct=${formatNumber(final.minEquityPct)} capitalRequired=${formatNullable(final.capitalRequiredAtRiskPct)} capitalMultiple=${formatNumber(final.capitalMultipleNeededToNeverGoBelowStart)}`);
  console.log(`guarded_judgeable=${guarded.summary.judgeableTrades} guarded_skipped=${guarded.skipped} guarded_wins=${guarded.summary.wins} guarded_losses=${guarded.summary.losses} guarded_totalR=${formatNumber(guarded.summary.totalR)} guarded_avgR=${formatNumber(guarded.summary.averageR)} guarded_maxDD=${formatNumber(guarded.summary.maxDrawdownR)} guarded_maxDDFrom=${guarded.summary.maxDrawdownFrom} guarded_maxDDAt=${guarded.summary.maxDrawdownAt} guarded_minEquity=${formatNumber(guarded.summary.minEquityR)} guarded_minEquityAt=${guarded.summary.minEquityAt}`);
  console.log(`radar_born=${sumRadarEvents(evaluations, "radar-born")} radar_improved=${sumRadarEvents(evaluations, "radar-improved")} radar_deteriorated=${sumRadarEvents(evaluations, "radar-deteriorated")} radar_promoted=${sumRadarEvents(evaluations, "radar-promoted")} radar_killed=${sumRadarEvents(evaluations, "radar-killed")} radar_expired=${sumRadarEvents(evaluations, "radar-expired")}`);
  console.log(`decision=${decisionFor(evaluations, final)}`);
}

function sumRadarEvents(evaluations: AssetEvaluation[], type: ReaderRadarEvent["type"]): number {
  return evaluations.reduce((sum, evaluation) => sum + evaluation.report.radarEvents.filter((event) => event.type === type).length, 0);
}

async function writeTradeTapeIfRequested(evaluations: AssetEvaluation[]): Promise<void> {
  if (!tradeTapeOut) return;
  await mkdir(dirname(tradeTapeOut), { recursive: true });
  await writeFile(tradeTapeOut, `${JSON.stringify(tradeTapeFor(evaluations), null, 2)}\n`);
  console.log(`trade_tape=${tradeTapeOut}`);
}

async function writeCandidateTapeIfRequested(evaluations: AssetEvaluation[]): Promise<void> {
  if (!candidateTapeOut) return;
  await mkdir(dirname(candidateTapeOut), { recursive: true });
  await writeFile(candidateTapeOut, `${JSON.stringify(candidateTapeFor(evaluations), null, 2)}\n`);
  console.log(`candidate_tape=${candidateTapeOut}`);
}

async function writeRadarEventsIfRequested(evaluations: AssetEvaluation[]): Promise<void> {
  if (!radarEventsOut) return;
  await mkdir(dirname(radarEventsOut), { recursive: true });
  await writeFile(radarEventsOut, `${JSON.stringify(radarEventsFor(evaluations), null, 2)}\n`);
  console.log(`radar_events=${radarEventsOut}`);
}

function radarEventsFor(evaluations: AssetEvaluation[]) {
  const assets = evaluations.map((evaluation) => ({
    asset: evaluation.asset,
    status: evaluation.status,
    events: evaluation.report.radarEvents,
  }));
  return {
    run: runMetadata(),
    summary: {
      born: sumRadarEvents(evaluations, "radar-born"),
      improved: sumRadarEvents(evaluations, "radar-improved"),
      deteriorated: sumRadarEvents(evaluations, "radar-deteriorated"),
      promoted: sumRadarEvents(evaluations, "radar-promoted"),
      killed: sumRadarEvents(evaluations, "radar-killed"),
      expired: sumRadarEvents(evaluations, "radar-expired"),
      ignored: sumRadarEvents(evaluations, "radar-ignored"),
    },
    assets,
  };
}

function candidateTapeFor(evaluations: AssetEvaluation[]) {
  const assetsWithTapes = evaluations.map((evaluation) => ({
    asset: evaluation.asset,
    status: evaluation.status,
    diagnostics: evaluation.report.diagnostics,
    tape: buildReaderCandidateTape({
      historySteps: evaluation.report.historySteps,
      setupResults: evaluation.report.setupResults,
      resultUpdates: evaluation.report.resultUpdates,
    }),
  }));
  return {
    run: runMetadata(),
    summary: {
      candidates: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.candidates, 0),
      directional: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.directional, 0),
      nonDirectional: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.nonDirectional, 0),
      worked: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.worked, 0),
      invalidated: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.invalidated, 0),
      unresolved: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.unresolved, 0),
      unjudgeable: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.unjudgeable, 0),
      executed: assetsWithTapes.reduce((sum, item) => sum + item.tape.summary.executed, 0),
    },
    assets: assetsWithTapes,
  };
}

function runMetadata() {
  return {
    venue,
    network,
    dataMode,
    bucketEventMode,
    narrativeSessionMode,
    interval,
    assets,
    startAt: iso(startMs),
    endAt: iso(endMs),
    readIntervalMs,
    orderflowWindowMs,
    setupTtlMs,
    minCoveragePct,
    dailyLossLimitR,
    readerRadar,
    readerRadarMaxStaleMs,
    tradeStyle,
    riskPct,
    feePct,
    slippagePct,
    initialCapital: initialCapital ?? null,
    absorptionPolicy,
    auctionLevelCandles: auctionLevelCandles ?? null,
    profileTradeSampleLimit: profileTradeSampleLimit ?? null,
    localRangeCandles: localRangeCandles ?? null,
    chunking: chunkDays ? "days" : chunkMonths ? "months" : "none",
    includeFormationTransition,
  };
}

function tradeTapeFor(evaluations: AssetEvaluation[]) {
  const final = finalSummary(evaluations);
  const guarded = guardedFinalSummary(evaluations);
  return {
    run: runMetadata(),
    summary: {
      registeredTrades: final.registeredTrades,
      judgeableTrades: final.judgeableTrades,
      unjudgeableTrades: final.unjudgeableTrades,
      wins: final.wins,
      losses: final.losses,
      totalR: final.totalR,
      averageR: final.averageR,
      maxDrawdownR: final.maxDrawdownR,
      maxDrawdownFrom: final.maxDrawdownFrom,
      maxDrawdownAt: final.maxDrawdownAt,
      minEquityR: final.minEquityR,
      minEquityAt: final.minEquityAt,
      returnPct: final.returnPct,
      maxDrawdownPct: final.maxDrawdownPct,
      minEquityPct: final.minEquityPct,
      capitalRequiredAtRiskPct: final.capitalRequiredAtRiskPct,
      capitalMultipleNeededToNeverGoBelowStart: final.capitalMultipleNeededToNeverGoBelowStart,
      guarded: {
        skipped: guarded.skipped,
        judgeableTrades: guarded.summary.judgeableTrades,
        wins: guarded.summary.wins,
        losses: guarded.summary.losses,
        totalR: guarded.summary.totalR,
        averageR: guarded.summary.averageR,
        maxDrawdownR: guarded.summary.maxDrawdownR,
        maxDrawdownFrom: guarded.summary.maxDrawdownFrom,
        maxDrawdownAt: guarded.summary.maxDrawdownAt,
        minEquityR: guarded.summary.minEquityR,
        minEquityAt: guarded.summary.minEquityAt,
      },
      decision: decisionFor(evaluations, final),
    },
    assets: evaluations.map((evaluation) => ({
      asset: evaluation.asset,
      status: evaluation.status,
      diagnostics: evaluation.report.diagnostics,
      summary: evaluation.summary,
      groups: tradeTapeGroups(evaluation.analysis),
      trades: evaluation.trades.map((trade, index) => tradeTapeRecord(evaluation.asset, index + 1, trade)),
    })),
  };
}

function tradeTapeGroups(analysis: ReaderAnalysisReport) {
  return {
    byDay: compactGroups(analysis.groups.byDay),
    byRegime: compactGroups(analysis.groups.byRegime),
    bySetupFamily: compactGroups(analysis.groups.bySetupFamily),
    bySetupFamilyRegime: compactGroups(analysis.groups.bySetupFamilyRegime),
    bySequence: compactGroups(analysis.groups.bySequence),
    byNarrative: compactGroups(analysis.groups.byNarrative),
    byAuctionMode: compactGroups(analysis.groups.byAuctionMode),
    byAuctionPhase: compactGroups(analysis.groups.byAuctionPhase),
    byOrderflowEvidence: compactGroups(analysis.groups.byOrderflowEvidence),
    byAbsorptionQuality: compactGroups(analysis.groups.byAbsorptionQuality),
    bySideLocation: compactGroups(analysis.groups.bySideLocation),
    byEntryTiming: compactGroups(analysis.groups.byEntryTiming),
    byFirstReaction: compactGroups(analysis.groups.byFirstReaction),
    byPocRotation: compactGroups(analysis.groups.byPocRotation),
    byQualityLabel: compactGroups(analysis.groups.byQualityLabel),
    byNarrativeVerdict: compactGroups(analysis.groups.byNarrativeVerdict),
    worstFamilies: compactGroups(analysis.groups.worstFamilies),
    bestFamilies: compactGroups(analysis.groups.bestFamilies),
    worstNarratives: compactGroups(analysis.groups.worstNarratives),
    narrativeFailureChains: analysis.narrativeFailureChains.map((chain) => ({
      day: chain.day,
      key: chain.key,
      losses: chain.losses,
      totalR: chain.totalR,
      tradeIndexes: chain.trades.map((trade) => analysis.trades.indexOf(trade) + 1),
    })),
  };
}

function compactGroups(groups: ReaderAnalysisGroup[]) {
  return groups.map((group) => ({
    key: group.key,
    summary: group.summary,
    tradeEntryTimes: group.trades.map((trade) => iso(trade.dossier.trade.entryAt)),
  }));
}

function tradeTapeRecord(asset: string, index: number, trade: ReaderAnalyzedTrade) {
  const dossier = trade.dossier;
  const result = dossier.trade;
  const read = dossier.formation.significantBeforeEntry[dossier.formation.significantBeforeEntry.length - 1];
  const auctionMode = result.auctionMode ?? dossier.auctionMode;
  return {
    index,
    asset,
    entryAt: iso(result.entryAt),
    side: result.side,
    setupFamily: result.setupFamily ?? null,
    trust: trade.trust,
    trustReason: trade.trustReason,
    result: {
      entryPrice: result.entryPrice,
      stop: result.stop,
      target: result.target,
      exitReason: result.exitReason ?? null,
      exitAt: result.exitAt === undefined ? null : iso(result.exitAt),
      exitPrice: result.exitPrice ?? null,
      r: result.r ?? null,
    },
    readerState: {
      regime: result.regime?.mode ?? null,
      auctionLocation: read?.auction.location ?? dossier.auction.location,
      auctionLevelKind: read?.auction.levelKind ?? dossier.auction.level?.kind ?? null,
      auctionMode: auctionMode?.mode ?? null,
      auctionPhase: auctionMode?.phase ?? null,
      sequencePhase: result.sequencePhase ?? dossier.setup.sequencePhase ?? null,
      setupPlanSource: dossier.setup.planSource,
      setupAgeMs: dossier.setup.setupAgeMs,
      setupReadCount: dossier.setup.readCount,
      setupReasons: dossier.setup.reasons,
    },
    absorptionQuality: read?.absorptionQuality ?? null,
    narrative: {
      intent: read?.narrative?.intent ?? null,
      direction: read?.narrative?.direction ?? null,
      participation: read?.narrative?.participation ?? null,
      verdict: trade.narrativeAudit.verdict,
      key: trade.narrativeAudit.key,
      invalidatingEvidence: trade.narrativeAudit.invalidatingEvidence,
    },
    vp: {
      auction: read?.vp?.auction ?? null,
      poc: read?.vp?.poc ?? null,
      value: read?.vp?.value ?? null,
    },
    orderflow: {
      pressure: read?.orderflow.pressure ?? dossier.orderflow.pressure,
      events: read?.orderflow.events ?? dossier.orderflow.events,
      tradeCount: read?.orderflow.tradeCount ?? dossier.orderflow.tradeCount,
      buyVolume: dossier.orderflow.buyVolume,
      sellVolume: dossier.orderflow.sellVolume,
      delta: read?.orderflow.delta ?? dossier.orderflow.delta,
      averageTradeSize: dossier.orderflow.averageTradeSize,
      largestTrade: read?.orderflow.largestTrade ?? dossier.orderflow.largestTrade,
      evidence: read?.orderflow.evidence ?? dossier.orderflow.evidence ?? null,
      initiative: read?.orderflow.initiative ?? dossier.orderflow.initiative ?? null,
      tape: read?.orderflow.tape ?? dossier.orderflow.tape ?? null,
    },
    diagnostics: {
      firstReaction: trade.metrics.firstReaction,
      firstReactionR: trade.metrics.firstReactionR,
      observedMfeR: trade.metrics.observedMfeR,
      observedMaeR: trade.metrics.observedMaeR,
      timeInTradeMs: trade.metrics.timeInTradeMs,
      pricedReadsAfterEntry: trade.metrics.pricedReadsAfterEntry,
      entryTiming: trade.metrics.entryTiming,
      pocRotation: trade.metrics.pocRotation,
      labels: trade.labels,
    },
    reviewVerdict: null,
    reviewNotes: null,
    dossierVerdict: dossier.verdict,
    ...(includeFormationTransition ? { formationTransition: formationTransitionFor(trade) } : {}),
  };
}

function formationTransitionFor(trade: ReaderAnalyzedTrade) {
  const dossier = trade.dossier;
  const before = dossier.formation.significantBeforeEntry[dossier.formation.significantBeforeEntry.length - 1] ?? null;
  const firstPricedAfter = dossier.formation.afterEntry.find((read) => read.lastPrice !== null) ?? null;
  return {
    beforeEntry: before ? compactFormationRead(before) : null,
    firstPricedAfterEntry: firstPricedAfter ? compactFormationRead(firstPricedAfter) : null,
  };
}

function compactFormationRead(read: ReaderAnalyzedTrade["dossier"]["formation"]["afterEntry"][number]) {
  return {
    at: iso(read.at),
    stance: read.stance,
    lastPrice: read.lastPrice,
    narrative: read.narrative
      ? {
          intent: read.narrative.intent,
          direction: read.narrative.direction,
          participation: read.narrative.participation,
          levelStory: read.narrative.levelStory,
        }
      : null,
    auction: {
      location: read.auction.location,
      levelKind: read.auction.levelKind,
      levelPrice: read.auction.levelPrice,
      poc: read.auction.poc,
    },
    vp: read.vp
      ? {
          auction: read.vp.auction,
          poc: read.vp.poc,
          value: read.vp.value,
        }
      : null,
    absorptionQuality: read.absorptionQuality
      ? {
          quality: read.absorptionQuality.quality,
          side: read.absorptionQuality.side,
          targetMovesTowardPoc: read.absorptionQuality.targetMovesTowardPoc,
        }
      : null,
    orderflow: {
      pressure: read.orderflow.pressure,
      events: read.orderflow.events,
      delta: read.orderflow.delta,
      tradeCount: read.orderflow.tradeCount,
      largestTradeSide: read.orderflow.largestTrade?.side ?? null,
      initiative: read.orderflow.initiative
        ? {
            side: read.orderflow.initiative.side,
            conviction: read.orderflow.initiative.conviction,
          }
        : null,
      tape: read.orderflow.tape
        ? {
            buyShare: read.orderflow.tape.buyShare,
            sellShare: read.orderflow.tape.sellShare,
            deltaShare: read.orderflow.tape.deltaShare,
            dominantShare: read.orderflow.tape.dominantShare,
            largestTradeShare: read.orderflow.tape.largestTradeShare,
            lastTradeRank: read.orderflow.tape.lastTradeRank,
            priceChange: read.orderflow.tape.priceChange,
          }
        : null,
    },
    setupEvents: read.setup.eventTypes,
    resultEvents: read.resultEventTypes,
  };
}

function printAssetEvaluation(evaluation: AssetEvaluation): void {
  const diagnostics = evaluation.report.diagnostics;
  console.log(evaluation.asset);
  console.log(`data: candles=${diagnostics.candleCount} orderflow_events=${diagnostics.orderflowEventCount} first_orderflow=${nullableIso(diagnostics.firstOrderflowAt)} last_orderflow=${nullableIso(diagnostics.lastOrderflowAt)} status=${evaluation.status}`);
  printReaderDiagnostics(evaluation.report);
  printResultAnalysis(evaluation.analysis);
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
  console.log(`  registered=${evaluation.summary.registeredTrades} judgeable=${evaluation.summary.judgeableTrades} unjudgeable=${evaluation.summary.unjudgeableTrades} wins=${evaluation.summary.wins} losses=${evaluation.summary.losses} totalR=${formatNumber(evaluation.summary.totalR)} avgR=${formatNumber(evaluation.summary.averageR)} maxDD=${formatNumber(evaluation.summary.maxDrawdownR)} maxDDFrom=${evaluation.summary.maxDrawdownFrom} maxDDAt=${evaluation.summary.maxDrawdownAt} minEquity=${formatNumber(evaluation.summary.minEquityR)} minEquityAt=${evaluation.summary.minEquityAt} returnPct=${formatNumber(evaluation.summary.returnPct)}`);
  console.log(`  decision=${assetDecisionFor(evaluation)}`);
  console.log("");
}

function printTrade(index: number, trade: ReaderAnalyzedTrade): void {
  const dossier = trade.dossier;
  const result = dossier.trade;
  const read = dossier.formation.significantBeforeEntry[dossier.formation.significantBeforeEntry.length - 1];
  const readText = read
    ? `${read.narrative?.intent ?? "no-narrative"}/${read.narrative?.direction ?? "none"} ${read.auction.location} ${read.auction.levelKind ?? "level"} + ${read.orderflow.pressure} + ${read.orderflow.events.join("+") || "no-orderflow-event"} absorption=${read.absorptionQuality?.quality ?? "none"}`
    : `${dossier.auction.location} ${dossier.auction.level?.kind ?? "level"} + ${dossier.orderflow.pressure} + ${dossier.orderflow.events.join("+") || "no-orderflow-event"}`;
  const vpText = read?.vp
    ? `${read.vp.auction}/${read.vp.poc}/${read.vp.value}`
    : "no-vp";
  const auctionMode = result.auctionMode ?? dossier.auctionMode;
  console.log(`  ${index}. ${iso(result.entryAt)} ${result.side} family=${result.setupFamily ?? "legacy"} mode=${auctionMode?.mode ?? "unknown"}/${auctionMode?.phase ?? "unknown"} sequence=${result.sequencePhase ?? "n/a"} regime=${result.regime?.mode ?? "unknown"} entry=${formatNumber(result.entryPrice)} stop=${formatNumber(result.stop)} target=${formatNumber(result.target)} exit=${result.exitReason ?? "open"} exitPrice=${formatNullable(result.exitPrice)} r=${formatNullable(result.r)} trust=${trade.trust}`);
  console.log(`     read=${readText} vp=${vpText}`);
  console.log(`     diagnostics first=${trade.metrics.firstReaction} firstR=${formatNullable(trade.metrics.firstReactionR ?? undefined)} observedMfeR=${formatNullable(trade.metrics.observedMfeR ?? undefined)} observedMaeR=${formatNullable(trade.metrics.observedMaeR ?? undefined)} timing=${trade.metrics.entryTiming} poc=${trade.metrics.pocRotation} narrative=${trade.narrativeAudit.verdict} labels=${trade.labels.join("+")}`);
  if (trade.narrativeAudit.invalidatingEvidence.length > 0) {
    console.log(`     invalidating=${trade.narrativeAudit.invalidatingEvidence.join(" | ")}`);
  }
  console.log(`     reason=${trade.trustReason} verdict=${dossier.verdict}`);
}

function printReaderDiagnostics(report: ReportView): void {
  const planStatuses = countBy(report.setupResults, (result) => result.plan.status);
  const setupEvents = countBy(report.setupEvents, (event) => event.type);
  const auctionLocations = countBy(report.historySteps, (step) => step.read.auction.location);
  const auctionModes = countBy(report.historySteps, (step) => step.read.auctionMode?.mode ?? "unknown");
  const auctionPhases = countBy(report.historySteps, (step) => step.read.auctionMode?.phase ?? "unknown");
  const vpAuction = countBy(report.historySteps, (step) => step.read.vpState?.auction ?? "unknown");
  const vpPoc = countBy(report.historySteps, (step) => step.read.vpState?.poc ?? "unknown");
  const vpValue = countBy(report.historySteps, (step) => step.read.vpState?.value ?? "unknown");
  const orderflowPressure = countBy(report.historySteps, (step) => step.read.orderflow.pressure);
  const narrativeIntents = countBy(report.historySteps, (step) => step.read.narrativeRead?.intent ?? "no-narrative");
  const narrativeParticipation = countBy(report.historySteps, (step) => step.read.narrativeRead?.participation ?? "unknown");
  const absorptionQuality = countBy(report.historySteps, (step) => step.read.absorptionQuality?.quality ?? "none");
  const topReasons = topCounts(report.setupResults.flatMap((result) => result.plan.reasons), 8);
  const vpBlocks = topCounts(report.setupResults.flatMap((result) => result.plan.reasons.filter((reason) => reason.startsWith("VP "))), 8);
  console.log(`reader: reads=${report.summary.totalReads} entries_opened=${report.summary.entriesOpened} outcomes=${report.summary.totalOutcomes} open=${report.open ? "yes" : "no"}`);
  console.log(`  plans=${formatCounts(planStatuses)} setup_events=${formatCounts(setupEvents)}`);
  console.log(`  auction=${formatCounts(auctionLocations)} auction_mode=${formatCounts(auctionModes)} auction_phase=${formatCounts(auctionPhases)} orderflow=${formatCounts(orderflowPressure)}`);
  console.log(`  vp_auction=${formatCounts(vpAuction)} vp_poc=${formatCounts(vpPoc)} vp_value=${formatCounts(vpValue)}`);
  console.log(`  narrative_intent=${formatCounts(narrativeIntents)} participation=${formatCounts(narrativeParticipation)}`);
  console.log(`  absorption_quality=${formatCounts(absorptionQuality)}`);
  console.log(`  top_no_trade_reasons=${topReasons.length === 0 ? "none" : topReasons.map(([reason, count]) => `${count}x ${reason}`).join(" | ")}`);
  console.log(`  vp_blocks=${vpBlocks.length === 0 ? "none" : vpBlocks.map(([reason, count]) => `${count}x ${reason}`).join(" | ")}`);
}

function printResultAnalysis(analysis: ReaderAnalysisReport): void {
  const judgeable = analysis.trades.filter((trade) => trade.trust);
  console.log("analysis:");
  if (judgeable.length === 0) {
    console.log("  no judgeable trades");
    return;
  }
  printGroups("  by_day", analysis.groups.byDay, 10);
  printGroups("  by_regime", analysis.groups.byRegime, 8);
  printGroups("  by_setup_family", analysis.groups.bySetupFamily, 8);
  printGroups("  by_setup_family_regime", analysis.groups.bySetupFamilyRegime, 10);
  printGroups("  by_sequence", analysis.groups.bySequence, 8);
  printGroups("  by_narrative", analysis.groups.byNarrative, 10);
  printGroups("  by_auction_mode", analysis.groups.byAuctionMode, 8);
  printGroups("  by_auction_phase", analysis.groups.byAuctionPhase, 8);
  printGroups("  by_orderflow_evidence", analysis.groups.byOrderflowEvidence, 10);
  printGroups("  by_absorption_quality", analysis.groups.byAbsorptionQuality, 10);
  printGroups("  by_entry_timing", analysis.groups.byEntryTiming, 8);
  printGroups("  by_first_reaction", analysis.groups.byFirstReaction, 8);
  printGroups("  by_poc_rotation", analysis.groups.byPocRotation, 8);
  printGroups("  by_quality_label", analysis.groups.byQualityLabel, 10);
  printGroups("  by_narrative_verdict", analysis.groups.byNarrativeVerdict, 8);
  printGroups("  worst_families", analysis.groups.worstFamilies, 8, "ranked");
  printGroups("  best_families", analysis.groups.bestFamilies, 5, "ranked");
  printGroups("  worst_narratives", analysis.groups.worstNarratives, 8, "ranked");
  printGroups("  by_side_location", analysis.groups.bySideLocation, 8);
  printNarrativeFailureChains(analysis);
  console.log(`  guarded_summary daily_loss_limit_r=${dailyLossLimitR} skipped=${analysis.guarded.skipped} trades=${analysis.guarded.summary.judgeableTrades} wins=${analysis.guarded.summary.wins} losses=${analysis.guarded.summary.losses} totalR=${formatNumber(analysis.guarded.summary.totalR)} avgR=${formatNumber(analysis.guarded.summary.averageR)} maxDD=${formatNumber(analysis.guarded.summary.maxDrawdownR)} maxDDFrom=${analysis.guarded.summary.maxDrawdownFrom} maxDDAt=${analysis.guarded.summary.maxDrawdownAt} minEquity=${formatNumber(analysis.guarded.summary.minEquityR)} minEquityAt=${analysis.guarded.summary.minEquityAt}`);
  printGroups("  guarded_by_day", analyzeReaderTrades({ trades: analysis.guarded.trades.map((trade) => trade.dossier), minCoveragePct, dailyLossLimitR, riskPct, feePct, slippagePct, initialCapital }).groups.byDay, 10);
}

function printNarrativeFailureChains(analysis: ReaderAnalysisReport): void {
  console.log("  narrative_failure_chains");
  if (analysis.narrativeFailureChains.length === 0) {
    console.log("    none");
    return;
  }
  for (const chain of analysis.narrativeFailureChains.slice(0, 8)) {
    const verdicts = formatCounts(countBy(chain.trades, (trade) => trade.narrativeAudit.verdict));
    console.log(`    ${chain.day}|${chain.key}: losses=${chain.losses} trades=${chain.trades.length} totalR=${formatNumber(chain.totalR)} verdicts=${verdicts}`);
  }
}

function printGroups(
  label: string,
  groups: ReaderAnalysisGroup[],
  limit: number,
  order: "key" | "ranked" = "key",
): void {
  const sorted = order === "ranked" ? groups : [...groups].sort((left, right) => left.key.localeCompare(right.key));
  console.log(label);
  for (const group of sorted.slice(0, limit)) {
    console.log(`    ${group.key}: trades=${group.summary.judgeableTrades} wins=${group.summary.wins} losses=${group.summary.losses} totalR=${formatNumber(group.summary.totalR)} avgR=${formatNumber(group.summary.averageR)} maxDD=${formatNumber(group.summary.maxDrawdownR)}`);
  }
}

function finalSummary(evaluations: AssetEvaluation[]): ReaderAnalysisSummary {
  return summarizeReaderTrades(evaluations.flatMap((evaluation) => evaluation.trades), summaryOptions());
}

function guardedFinalSummary(evaluations: AssetEvaluation[]): {
  skipped: number;
  summary: ReaderAnalysisSummary;
} {
  const guarded = analyzeReaderTrades({
    trades: evaluations.flatMap((evaluation) => evaluation.trades.map((trade) => trade.dossier)),
    minCoveragePct,
    dailyLossLimitR,
    ...summaryOptions(),
  }).guarded;
  return {
    skipped: guarded.skipped,
    summary: guarded.summary,
  };
}

function decisionFor(evaluations: AssetEvaluation[], summary: ReaderAnalysisSummary): string {
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

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : "n/a";
}

function formatNullable(value: number | null | undefined): string {
  return value === undefined || value === null ? "n/a" : formatNumber(value);
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function nullableIso(time: number | null): string {
  return time === null ? "n/a" : iso(time);
}

async function readBybitRawOrderflow(asset: string, candleIntervalMs: number): Promise<{
  candles: Candle[];
  orderflowEvents: OrderflowEvent[];
}> {
  const orderflowEvents = await readBybitOrderflowEvents(asset);
  return {
    candles: candlesFromTrades({ asset, events: orderflowEvents, candleIntervalMs }),
    orderflowEvents,
  };
}

function summaryOptions() {
  return {
    riskPct,
    feePct,
    slippagePct,
    initialCapital,
  };
}

async function runBybitChunkedParquetReport(asset: string): Promise<ReportView> {
  const candleIntervalMs = intervalMs(interval);
  const setupMemory = createReaderSetupMemory({ ttlMs: setupTtlMs });
  const narrativeMemory = createReaderNarrativeStateMemory();
  const resultState = createReaderResultState();
  const radarConfig = readerRadarConfig();
  const radarMemory = radarConfig ? createReaderRadarMemory() : null;
  const setupResults: ReaderSetupResult[] = [];
  const setupEvents: ReaderSetupEvent[] = [];
  const radarUpdates: ReaderRadarUpdate[] = [];
  const radarEvents: ReaderRadarEvent[] = [];
  const resultUpdates: ReaderResultUpdate[] = [];
  const resultEvents: ReaderResultEvent[] = [];
  const entries: ReaderResultEntry[] = [];
  const historySteps: ReaderHistoryReplayResult["historySteps"] = [];
  const evidenceTrades: ReaderEvidenceReport["trades"] = [];
  let candleCount = 0;
  let orderflowEventCount = 0;
  let firstOrderflowAt: number | null = null;
  let lastOrderflowAt: number | null = null;

  for (const chunk of timeChunks(startMs, endMs)) {
    const buckets = await readOrderflowBuckets({
      rootDir: marketStoreRoot,
      venue: "bybit",
      market: "trading",
      symbol: asset,
      startMs: chunk.start,
      endMs: chunk.end,
    });
    const candles = candlesFromBuckets({ buckets, candleIntervalMs });
    const orderflowEvents = orderflowEventsFromBuckets({ asset, buckets, mode: bucketEventMode });
    candleCount += candles.length;
    orderflowEventCount += orderflowEvents.length;
    firstOrderflowAt ??= firstEventTime(orderflowEvents);
    lastOrderflowAt = lastEventTime(orderflowEvents) ?? lastOrderflowAt;

    const replay = runReaderHistoryReplay({
      asset,
      interval,
      candleIntervalMs,
      candles,
      orderflowEvents,
      readIntervalMs,
      orderflowWindowMs,
      startAt: chunk.start,
      endAt: chunk.end,
      auctionConfig: auctionConfig(),
      readerConfig: { absorptionPolicy },
      replay: {
        radarConfig,
        ...(radarMemory ? { radarMemory } : {}),
        setupMemory,
        resultState,
        setupConfig: {
          tradePlanConfig: tradePlanConfig(),
          setupTtlMs,
          narrativeState: {
            memory: narrativeMemory,
            sessionMode: narrativeSessionMode,
          },
        },
      },
    });
    const executionQuality = analyzeReaderExecutionQuality({ readIntervalMs, replay });
    const evidence = buildReaderEvidenceReport({
      candles,
      candleIntervalMs,
      readIntervalMs,
      executionQuality,
      replay,
    });

    setupResults.push(...replay.setupResults);
    setupEvents.push(...replay.setupEvents);
    radarUpdates.push(...replay.radarUpdates);
    radarEvents.push(...replay.radarEvents);
    resultUpdates.push(...replay.resultUpdates);
    resultEvents.push(...replay.resultEvents);
    entries.push(...replay.entries);
    historySteps.push(...replay.historySteps);
    evidenceTrades.push(...evidence.trades);
    console.log(`chunk ${asset} ${iso(chunk.start)} -> ${iso(chunk.end)} candles=${candles.length} events=${orderflowEvents.length} entries=${replay.entries.length} outcomes=${replay.outcomes.length}`);
  }

  const outcomes = resultState.outcomes;
  const summary = summarizeReaderOutcomes({
    totalReads: historySteps.length,
    totalEntries: entries.length,
    entriesOpened: entries.length,
    outcomes,
  });
  const report = {
    setupResults,
    setupEvents,
    radarUpdates,
    radarEvents,
    resultUpdates,
    resultEvents,
    entries,
    outcomes,
    open: resultState.open,
    summary,
    setupMemory,
    radarMemory,
    narrativeMemory,
    resultState,
    historySteps,
  };
  const aggregateExecutionQuality = analyzeReaderExecutionQuality({ readIntervalMs, replay: report });
  return {
    ...report,
    diagnostics: {
      candleCount,
      orderflowEventCount,
      firstOrderflowAt,
      lastOrderflowAt,
    },
    executionQuality: aggregateExecutionQuality,
    evidence: {
      summary,
      dataQuality: {
        tradeCount: evidenceTrades.length,
        missingPriceReads: evidenceTrades.reduce((sum, trade) => sum + trade.execution.missingPriceReads, 0),
        degradedTrades: evidenceTrades.filter((trade) => trade.execution.quality === "degraded").length,
        unusableTrades: evidenceTrades.filter((trade) => trade.execution.quality === "unusable").length,
        replayQuality: aggregateExecutionQuality.replayQuality,
      },
      trades: evidenceTrades,
    },
  };
}

async function readBybitCompactOrderflow(asset: string, candleIntervalMs: number): Promise<{
  candles: Candle[];
  orderflowEvents: OrderflowEvent[];
}> {
  const buckets = await readOrderflowBuckets({
    rootDir: marketStoreRoot,
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  return {
    candles: candlesFromBuckets({ buckets, candleIntervalMs }),
    orderflowEvents: orderflowEventsFromBuckets({ asset, buckets, mode: bucketEventMode }),
  };
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

function candlesFromBuckets(input: {
  buckets: OrderflowBucket[];
  candleIntervalMs: number;
}): Candle[] {
  const byStart = new Map<number, Candle>();
  for (const bucket of input.buckets) {
    const start = Math.floor(bucket.bucketMs / input.candleIntervalMs) * input.candleIntervalMs;
    const existing = byStart.get(start);
    const volume = bucket.buyVolume + bucket.sellVolume;
    if (!existing) {
      byStart.set(start, {
        t: start,
        o: bucket.open,
        h: bucket.high,
        l: bucket.low,
        c: bucket.close,
        v: volume,
      });
      continue;
    }
    existing.h = Math.max(existing.h, bucket.high);
    existing.l = Math.min(existing.l, bucket.low);
    existing.c = bucket.close;
    existing.v += volume;
  }
  return [...byStart.values()].sort((a, b) => a.t - b.t);
}

function orderflowEventsFromBuckets(input: {
  asset: string;
  buckets: OrderflowBucket[];
  mode: BucketEventMode;
}): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  for (const bucket of input.buckets) {
    events.push(...bucketTradeEvents({ asset: input.asset, bucket, mode: input.mode }));
  }
  return events.sort((left, right) => eventTime(left) - eventTime(right));
}

function bucketTradeEvents(input: {
  asset: string;
  bucket: OrderflowBucket;
  mode: BucketEventMode;
}): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  const largestSize = Math.max(0, input.bucket.largestTradeSize);
  const largestBuy = input.bucket.largestTradeSide === "buy" ? largestSize : 0;
  const largestSell = input.bucket.largestTradeSide === "sell" ? largestSize : 0;
  const buyRemainder = Math.max(0, input.bucket.buyVolume - largestBuy);
  const sellRemainder = Math.max(0, input.bucket.sellVolume - largestSell);
  const firstSide = input.bucket.delta >= 0 ? "buy" : "sell";

  if (buyRemainder > 0) {
    events.push(...bucketSideEvents({
      asset: input.asset,
      idPrefix: `${input.bucket.bucketMs}:buy`,
      side: "buy",
      totalSize: buyRemainder,
      maxChunkSize: largestSize,
      price: firstSide === "buy" ? input.bucket.open : input.bucket.close,
      time: input.bucket.bucketMs,
      mode: input.mode,
    }));
  }
  if (sellRemainder > 0) {
    events.push(...bucketSideEvents({
      asset: input.asset,
      idPrefix: `${input.bucket.bucketMs}:sell`,
      side: "sell",
      totalSize: sellRemainder,
      maxChunkSize: largestSize,
      price: firstSide === "sell" ? input.bucket.open : input.bucket.close,
      time: input.bucket.bucketMs,
      mode: input.mode,
    }));
  }
  if (largestSize > 0) {
    events.push(bucketTradeEvent({
      asset: input.asset,
      id: `${input.bucket.bucketMs}:largest`,
      side: input.bucket.largestTradeSide,
      size: largestSize,
      price: input.bucket.largestTradePrice || input.bucket.close,
      time: input.bucket.bucketMs,
    }));
  }
  return events;
}

function bucketSideEvents(input: {
  asset: string;
  idPrefix: string;
  side: "buy" | "sell";
  totalSize: number;
  maxChunkSize: number;
  price: number;
  time: number;
  mode: BucketEventMode;
}): OrderflowEvent[] {
  if (input.mode === "aggregate") {
    return [bucketTradeEvent({
      asset: input.asset,
      id: `${input.idPrefix}:aggregate`,
      side: input.side,
      size: input.totalSize,
      price: input.price,
      time: input.time,
    })];
  }

  const targetChunkSize = input.maxChunkSize > 0 ? Math.max(input.maxChunkSize * 0.75, input.totalSize / 8) : input.totalSize;
  const chunks = Math.max(1, Math.min(8, Math.ceil(input.totalSize / targetChunkSize)));
  const size = input.totalSize / chunks;
  const events: OrderflowEvent[] = [];
  for (let index = 0; index < chunks; index += 1) {
    events.push(bucketTradeEvent({
      asset: input.asset,
      id: `${input.idPrefix}:${index}`,
      side: input.side,
      size,
      price: input.price,
      time: input.time,
    }));
  }
  return events;
}

function bucketTradeEvent(input: {
  asset: string;
  id: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  time: number;
}): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: input.time,
    trade: {
      asset: input.asset,
      side: input.side,
      price: input.price,
      size: input.size,
      time: input.time,
      id: input.id,
    },
  };
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

function monthChunks(start: number, end: number): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < end) {
    const chunkStart = Math.max(start, cursor.getTime());
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const chunkEnd = Math.min(end - 1, next.getTime() - 1);
    if (chunkEnd >= chunkStart) chunks.push({ start: chunkStart, end: chunkEnd });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return chunks;
}

function dayChunks(start: number, end: number): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < end) {
    const chunkStart = Math.max(start, cursor.getTime());
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    const chunkEnd = Math.min(end - 1, next.getTime() - 1);
    if (chunkEnd >= chunkStart) chunks.push({ start: chunkStart, end: chunkEnd });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

function timeChunks(start: number, end: number): Array<{ start: number; end: number }> {
  return chunkDays ? dayChunks(start, end) : monthChunks(start, end);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}
