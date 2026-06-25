import { candleWindowForTrade } from "./candle-window-for-trade";
import type { ReaderEvidenceInput, ReaderEvidenceReport, ReaderTradeDossier, ReaderTradeExecutionQuality, ReaderTradeVerdict } from "./types";
import type { AuctionRead } from "../../read-core/read/types";
import { analyzeReaderExecutionQuality } from "../reader-execution-quality/analyze-reader-execution-quality";
import type { ReaderExecutionQualityReport } from "../reader-execution-quality/types";
import { buildReaderFormationTape } from "../reader-formation/build-reader-formation-tape";
import type { ReaderFormationTape } from "../reader-formation/types";
import type { ReaderResultEntry, ReaderResultOutcome } from "../reader-result/types";

const DEFAULT_BEFORE_ENTRY_CANDLES = 50;
const DEFAULT_AFTER_EXIT_CANDLES = 20;

export function buildReaderEvidenceReport(input: ReaderEvidenceInput): ReaderEvidenceReport {
  const candles = [...input.candles].sort((a, b) => a.t - b.t);
  const beforeEntryCandles = input.beforeEntryCandles ?? DEFAULT_BEFORE_ENTRY_CANDLES;
  const afterExitCandles = input.afterExitCandles ?? DEFAULT_AFTER_EXIT_CANDLES;
  const executionReport = input.executionQuality ?? analyzeReaderExecutionQuality({
    readIntervalMs: input.readIntervalMs,
    replay: input.replay,
  });
  const formationTapes = buildReaderFormationTape({
    beforeEntryReads: input.beforeEntryFormationReads,
    afterEntryReads: input.afterEntryFormationReads,
    historySteps: input.replay.historySteps,
    setupResults: input.replay.setupResults,
    resultUpdates: input.replay.resultUpdates,
    entries: input.replay.entries,
    outcomes: input.replay.outcomes,
  });
  const trades = input.replay.entries.map((entry) => {
    const outcome = outcomeForEntry(entry, input.replay.outcomes);
    const open = input.replay.open && sameEntry(entry, input.replay.open) ? input.replay.open : null;
    return tradeDossier({
      entry,
      outcome,
      isOpen: open !== null && outcome === null,
      input,
      candles,
      beforeEntryCandles,
      afterExitCandles,
      executionReport,
      formationTapes,
    });
  });

  return {
    summary: input.replay.summary,
    dataQuality: {
      tradeCount: trades.length,
      missingPriceReads: executionReport.trades.reduce((sum, trade) => sum + trade.unpricedReadsWhileOpen, 0),
      degradedTrades: executionReport.trades.filter((trade) => trade.quality === "degraded").length,
      unusableTrades: executionReport.trades.filter((trade) => trade.quality === "unusable").length,
      replayQuality: executionReport.replayQuality,
    },
    trades,
  };
}

function tradeDossier(input: {
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  isOpen: boolean;
  input: ReaderEvidenceInput;
  candles: ReaderEvidenceInput["candles"];
  beforeEntryCandles: number;
  afterExitCandles: number;
  executionReport: ReaderExecutionQualityReport;
  formationTapes: ReaderFormationTape[];
}): ReaderTradeDossier {
  const entryUpdate = input.input.replay.resultUpdates.find((update) => update.opened && sameEntry(update.opened, input.entry));
  const setupResult = entryUpdate?.input;
  const execution = executionQualityForEntry(input.executionReport, input.entry);
  const formation = formationForEntry(input.formationTapes, input.entry);

  if (!setupResult) {
    throw new Error(`reader evidence could not find setup result for entry at ${input.entry.entryAt}`);
  }

  return {
    trade: input.outcome ? { ...input.outcome } : { ...input.entry },
    setup: {
      key: input.entry.setupKey,
      planSource: setupResult.planSource,
      setupAgeMs: setupResult.setup ? input.entry.entryAt - setupResult.setup.createdAt : null,
      readCount: setupResult.setup?.readCount ?? null,
      confidence: input.entry.confidence,
      reasons: [...input.entry.reasons],
      events: setupEventsForEntry(input.input, input.entry),
      sequencePhase: input.entry.sequencePhase,
      sequenceReason: input.entry.sequenceReason,
    },
    auction: compactAuction(setupResult.read.auction),
    auctionMode: setupResult.read.auctionMode,
    orderflow: setupResult.read.orderflow,
    candles: candleWindowForTrade({
      candles: input.candles,
      candleIntervalMs: input.input.candleIntervalMs,
      entry: input.entry,
      outcome: input.outcome,
      beforeEntryCandles: input.beforeEntryCandles,
      afterExitCandles: input.afterExitCandles,
    }),
    execution,
    formation: {
      beforeEntry: formation.beforeEntry,
      significantBeforeEntry: formation.significantBeforeEntry,
      afterEntry: formation.afterEntry,
    },
    verdict: verdictFor({ outcome: input.outcome, isOpen: input.isOpen, execution }),
  };
}

function formationForEntry(tapes: ReaderFormationTape[], entry: ReaderResultEntry): ReaderFormationTape {
  const tape = tapes.find((item) => sameEntry(item.entry, entry));
  if (!tape) {
    throw new Error(`reader evidence could not find formation tape for entry at ${entry.entryAt}`);
  }
  return tape;
}

function setupEventsForEntry(input: ReaderEvidenceInput, entry: ReaderResultEntry) {
  const key = entry.setupKey;
  if (key === null) return [];
  const seen = new Set<string>();
  const events = input.replay.resultUpdates
    .flatMap((update) => update.input.events)
    .filter((event) => event.key === key && event.at <= entry.entryAt && event.type !== "setup-none")
    .filter((event) => {
      const eventKey = `${event.type}|${event.key}|${event.at}|${event.reason}`;
      if (seen.has(eventKey)) return false;
      seen.add(eventKey);
      return true;
    });
  return events.slice(-20);
}

function compactAuction(auction: AuctionRead): ReaderTradeDossier["auction"] {
  return {
    asset: auction.asset,
    interval: auction.interval,
    level: auction.level,
    profile: auction.profile
      ? {
          low: auction.profile.low,
          high: auction.profile.high,
          binSize: auction.profile.binSize,
          poc: auction.profile.poc,
          valueAreaLow: auction.profile.valueAreaLow,
          valueAreaHigh: auction.profile.valueAreaHigh,
          binCount: auction.profile.bins.length,
        }
      : null,
    location: auction.location,
    bias: auction.bias,
    narrative: auction.narrative,
    invalidation: auction.invalidation,
    target: auction.target,
  };
}

function executionQualityForEntry(report: ReaderExecutionQualityReport, entry: ReaderResultEntry): ReaderTradeExecutionQuality {
  const trade = report.trades.find((item) => sameEntry(item.entry, entry));
  if (!trade) {
    throw new Error(`reader evidence could not find execution quality for entry at ${entry.entryAt}`);
  }
  return {
    missingPriceReads: trade.unpricedReadsWhileOpen,
    heldReads: trade.pricedReadsWhileOpen,
    pricedReadsWhileOpen: trade.pricedReadsWhileOpen,
    unpricedReadsWhileOpen: trade.unpricedReadsWhileOpen,
    coveragePctWhileOpen: trade.coveragePctWhileOpen,
    longestUnpricedRunWhileOpen: trade.longestUnpricedRunWhileOpen,
    longestUnpricedGapMsWhileOpen: trade.longestUnpricedGapMsWhileOpen,
    quality: trade.quality,
    diagnosis: trade.diagnosis,
  };
}

function verdictFor(input: {
  outcome: ReaderResultOutcome | null;
  isOpen: boolean;
  execution: ReaderTradeExecutionQuality;
}): ReaderTradeVerdict {
  if (input.isOpen || !input.outcome) return "open-trade";
  if (input.execution.quality === "unusable") return "result-unusable-price-coverage";
  if (input.execution.quality === "degraded") return "result-degraded-by-missing-prices";
  return input.outcome.r < 0 ? "valid-setup-bad-outcome" : "valid-setup-good-outcome";
}

function outcomeForEntry(entry: ReaderResultEntry, outcomes: ReaderResultOutcome[]): ReaderResultOutcome | null {
  return outcomes.find((outcome) => sameEntry(entry, outcome)) ?? null;
}

function sameEntry(left: ReaderResultEntry, right: ReaderResultEntry): boolean {
  return left.asset === right.asset
    && left.side === right.side
    && left.entryAt === right.entryAt
    && left.entryPrice === right.entryPrice
    && left.stop === right.stop
    && left.target === right.target;
}



