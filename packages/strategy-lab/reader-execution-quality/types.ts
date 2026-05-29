import type { ReaderReplaySummary } from "../reader-replay/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";

export type ReaderExecutionQuality = "clean" | "degraded" | "unusable" | "open";

export type ReaderExecutionDiagnosis =
  | "clean-price-coverage"
  | "missing-price-while-open"
  | "sparse-price-coverage"
  | "long-unpriced-gap"
  | "open-trade";

export type ReaderExecutionQualityInput = {
  readIntervalMs?: number;
  unusableCoveragePct?: number;
  unusableUnpricedRun?: number;
  replay: {
    summary: ReaderReplaySummary;
    resultUpdates: Array<{
      input: ReaderSetupResult;
      opened: ReaderResultEntry | null;
      closed: ReaderResultOutcome | null;
      events: ReaderResultEvent[];
    }>;
    entries: ReaderResultEntry[];
    outcomes: ReaderResultOutcome[];
    open: ReaderResultEntry | null;
  };
};

export type ReaderTradeExecutionQualityReport = {
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  pricedReadsWhileOpen: number;
  unpricedReadsWhileOpen: number;
  coveragePctWhileOpen: number;
  longestUnpricedRunWhileOpen: number;
  longestUnpricedGapMsWhileOpen: number | null;
  quality: ReaderExecutionQuality;
  diagnosis: ReaderExecutionDiagnosis;
};

export type ReaderExecutionQualityReport = {
  totalObservedReads: number;
  pricedReads: number;
  unpricedReads: number;
  priceCoveragePct: number;
  longestUnpricedRun: number;
  longestUnpricedGapMs: number | null;
  firstPricedAt: number | null;
  lastPricedAt: number | null;
  replayQuality: ReaderExecutionQuality;
  trades: ReaderTradeExecutionQualityReport[];
};
