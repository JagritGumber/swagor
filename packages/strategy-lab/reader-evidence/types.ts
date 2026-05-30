import type { LiveReaderRead } from "../reader-live/types";
import type { AuctionLocation, PriceLevel } from "../read/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderExecutionDiagnosis, ReaderExecutionQuality, ReaderExecutionQualityReport } from "../reader-execution-quality/types";
import type { ReaderFormationRead } from "../reader-formation/types";
import type { ReaderHistoryStep } from "../reader-history/types";
import type { ReaderReplaySummary } from "../reader-replay/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome } from "../reader-result/types";
import type { ReaderSetupEvent, ReaderSetupResult } from "../reader-setup/types";
import type { Candle } from "../types";

export type ReaderEvidenceWindowConfig = {
  beforeEntryCandles?: number;
  afterExitCandles?: number;
  beforeEntryFormationReads?: number;
  afterEntryFormationReads?: number;
};

export type ReaderEvidenceInput = ReaderEvidenceWindowConfig & {
  candles: Candle[];
  candleIntervalMs: number;
  readIntervalMs?: number;
  executionQuality?: ReaderExecutionQualityReport;
  replay: {
    summary: ReaderReplaySummary;
    resultUpdates: Array<{
      input: ReaderSetupResult;
      opened: ReaderResultEntry | null;
      closed: ReaderResultOutcome | null;
      events: ReaderResultEvent[];
    }>;
    setupResults?: ReaderSetupResult[];
    historySteps?: ReaderHistoryStep[];
    entries: ReaderResultEntry[];
    outcomes: ReaderResultOutcome[];
    open: ReaderResultEntry | null;
  };
};

export type ReaderCandleStats = {
  high: number | null;
  low: number | null;
  volume: number;
  range: number | null;
  entryClosePosition: number | null;
  postExitHigh: number | null;
  postExitLow: number | null;
};

export type ReaderCandleEvidence = {
  beforeEntry: Candle[];
  entryClosedCandle: Candle | null;
  exitClosedCandle: Candle | null;
  afterExit: Candle[];
  stats: ReaderCandleStats;
};

export type ReaderTradeExecutionQuality = {
  missingPriceReads: number;
  heldReads: number;
  pricedReadsWhileOpen: number;
  unpricedReadsWhileOpen: number;
  coveragePctWhileOpen: number;
  longestUnpricedRunWhileOpen: number;
  longestUnpricedGapMsWhileOpen: number | null;
  quality: ReaderExecutionQuality;
  diagnosis: ReaderExecutionDiagnosis;
};

export type ReaderTradeVerdict =
  | "valid-setup-bad-outcome"
  | "valid-setup-good-outcome"
  | "open-trade"
  | "result-degraded-by-missing-prices"
  | "result-unusable-price-coverage";

export type ReaderTradeDossier = {
  trade: ReaderResultEntry & Partial<Pick<ReaderResultOutcome, "exitPrice" | "exitAt" | "exitReason" | "r">>;
  setup: {
    key: string | null;
    planSource: ReaderSetupResult["planSource"];
    setupAgeMs: number | null;
    readCount: number | null;
    confidence: number;
    reasons: string[];
    events: ReaderSetupEvent[];
    sequencePhase?: ReaderResultEntry["sequencePhase"];
    sequenceReason?: string;
  };
  auction: {
    asset: string;
    interval: string;
    level: PriceLevel | null;
    profile: {
      low: number;
      high: number;
      binSize: number;
      poc: number;
      valueAreaLow: number;
      valueAreaHigh: number;
      binCount: number;
    } | null;
    location: AuctionLocation;
    bias: LiveReaderRead["auction"]["bias"];
    narrative: string;
    invalidation: string | null;
    target: string | null;
  };
  auctionMode?: ReaderAuctionMode;
  orderflow: LiveReaderRead["orderflow"];
  candles: ReaderCandleEvidence;
  execution: ReaderTradeExecutionQuality;
  formation: {
    beforeEntry: ReaderFormationRead[];
    significantBeforeEntry: ReaderFormationRead[];
    afterEntry: ReaderFormationRead[];
  };
  verdict: ReaderTradeVerdict;
};

export type ReaderEvidenceReport = {
  summary: ReaderReplaySummary;
  dataQuality: {
      tradeCount: number;
      missingPriceReads: number;
      degradedTrades: number;
      unusableTrades: number;
      replayQuality: ReaderExecutionQuality;
  };
  trades: ReaderTradeDossier[];
};
