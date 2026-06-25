import type { CandleInterval, HyperliquidNetwork } from "../../../market-data";
import type { ReaderExecutionQualityReport } from "../reader-execution-quality/types";
import type { ReaderEvidenceReport } from "../reader-evidence/types";
import type { ReaderHistoryAuctionConfig, ReaderHistoryReplayResult } from "../reader-history/types";

export type ReaderReplayReportInput = {
  vmUrl: string;
  orderflowRootDir: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  startMs: number;
  endMs: number;
  readIntervalMs: number;
  orderflowWindowMs?: number;
  setupTtlMs?: number;
  auctionConfig?: ReaderHistoryAuctionConfig;
};

export type ReaderReplayReportDiagnostics = {
  candleCount: number;
  orderflowEventCount: number;
  historyStepCount: number;
  missingOrderflowFiles: string[];
  firstCandleAt: number | null;
  lastCandleAt: number | null;
  firstOrderflowAt: number | null;
  lastOrderflowAt: number | null;
};

export type ReaderReplayReport = ReaderHistoryReplayResult & {
  diagnostics: ReaderReplayReportDiagnostics;
  executionQuality: ReaderExecutionQualityReport;
  evidence: ReaderEvidenceReport;
};



