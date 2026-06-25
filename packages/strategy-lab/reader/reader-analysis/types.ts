import type { ReaderTradeDossier } from "../reader-evidence/types";

export type ReaderAnalysisSummary = {
  registeredTrades: number;
  judgeableTrades: number;
  unjudgeableTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  maxDrawdownAt: string;
  maxDrawdownFrom: string;
  minEquityR: number;
  minEquityAt: string;
  returnPct: number;
  maxDrawdownPct: number;
  minEquityPct: number;
  capitalRequiredAtRiskPct: number | null;
  capitalMultipleNeededToNeverGoBelowStart: number;
};

export type ReaderTradeReaction =
  | "favorable-first-read"
  | "adverse-first-read"
  | "flat-first-read"
  | "no-priced-first-read";

export type ReaderTradeTiming =
  | "near-local-extreme"
  | "middle-of-local-range"
  | "away-from-local-extreme"
  | "unknown-local-range";

export type ReaderPocRotation =
  | "rotated-through-poc"
  | "moved-toward-poc"
  | "moved-away-from-poc"
  | "no-poc-reference";

export type ReaderTradeQualityLabel =
  | "clean-continuation"
  | "unclassified"
  | "late-entry"
  | "failed-follow-through"
  | "absorbed-but-no-rotation"
  | "needs-selbo-size-down"
  | "untrusted-result";

export type ReaderNarrativeVerdict =
  | "confirmed"
  | "weak-confirmed"
  | "invalidated"
  | "wrong"
  | "unjudgeable";

export type ReaderNarrativeAudit = {
  key: string;
  verdict: ReaderNarrativeVerdict;
  invalidatingEvidence: string[];
};

export type ReaderTradeAnalysisMetrics = {
  risk: number;
  r: number | null;
  observedMfeR: number | null;
  observedMaeR: number | null;
  firstReactionR: number | null;
  timeInTradeMs: number | null;
  pricedReadsAfterEntry: number;
  entryTiming: ReaderTradeTiming;
  firstReaction: ReaderTradeReaction;
  pocRotation: ReaderPocRotation;
};

export type ReaderAnalyzedTrade = {
  dossier: ReaderTradeDossier;
  trust: boolean;
  trustReason: string;
  metrics: ReaderTradeAnalysisMetrics;
  labels: ReaderTradeQualityLabel[];
  narrativeAudit: ReaderNarrativeAudit;
};

export type ReaderAnalysisGroup = {
  key: string;
  trades: ReaderAnalyzedTrade[];
  summary: ReaderAnalysisSummary;
};

export type ReaderGuardedAnalysis = {
  trades: ReaderAnalyzedTrade[];
  skipped: number;
  summary: ReaderAnalysisSummary;
};

export type ReaderNarrativeFailureChain = {
  key: string;
  day: string;
  trades: ReaderAnalyzedTrade[];
  losses: number;
  totalR: number;
};

export type ReaderAnalysisReport = {
  trades: ReaderAnalyzedTrade[];
  summary: ReaderAnalysisSummary;
  groups: {
    byDay: ReaderAnalysisGroup[];
    byRegime: ReaderAnalysisGroup[];
    bySetupFamily: ReaderAnalysisGroup[];
    bySetupFamilyRegime: ReaderAnalysisGroup[];
    bySequence: ReaderAnalysisGroup[];
    byNarrative: ReaderAnalysisGroup[];
    byAuctionMode: ReaderAnalysisGroup[];
    byAuctionPhase: ReaderAnalysisGroup[];
    byOrderflowEvidence: ReaderAnalysisGroup[];
    byAbsorptionQuality: ReaderAnalysisGroup[];
    bySideLocation: ReaderAnalysisGroup[];
    byEntryTiming: ReaderAnalysisGroup[];
    byFirstReaction: ReaderAnalysisGroup[];
    byPocRotation: ReaderAnalysisGroup[];
    byQualityLabel: ReaderAnalysisGroup[];
    byNarrativeVerdict: ReaderAnalysisGroup[];
    worstFamilies: ReaderAnalysisGroup[];
    bestFamilies: ReaderAnalysisGroup[];
    worstNarratives: ReaderAnalysisGroup[];
  };
  narrativeFailureChains: ReaderNarrativeFailureChain[];
  guarded: ReaderGuardedAnalysis;
};

export type AnalyzeReaderTradesInput = {
  trades: ReaderTradeDossier[];
  minCoveragePct?: number;
  dailyLossLimitR?: number;
  riskPct?: number;
  feePct?: number;
  slippagePct?: number;
  initialCapital?: number;
};



