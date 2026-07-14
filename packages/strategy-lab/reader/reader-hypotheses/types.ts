import type { ReaderCandidate, ReaderCandidateFamily } from "../reader-candidates/types";
import type { Side } from "@strategy-lab/types";

export type ReaderHypothesisConfirmationType = "none" | "first-reaction" | "max-favorable";

export type ReaderHypothesisConfirmation = {
  type: ReaderHypothesisConfirmationType;
  thresholdR: number;
};

export type ReaderHypothesisFilters = {
  family?: ReaderCandidateFamily;
  side?: Side;
  regime?: string;
  event?: string;
  vpAuction?: string;
  vpPoc?: string;
  vpValue?: string;
  pressure?: string;
  minInvalidationBps?: number;
  maxInvalidationBps?: number;
  minTradeCount?: number;
  maxTradeCount?: number;
  maxAbsResultR?: number;
};

export type ReaderHypothesis = {
  id: string;
  label: string;
  description: string;
  kind: "trend-following" | "adverse-reader" | "mixed-reader";
  filters: ReaderHypothesisFilters;
  confirmation: ReaderHypothesisConfirmation;
};

export type ReaderHypothesisEvaluationOptions = {
  roundTripCostBps?: number;
};

export type ReaderHypothesisSummary = {
  candidates: number;
  entries: number;
  skipped: number;
  worked: number;
  invalidated: number;
  winRate: number;
  totalR: number;
  averageR: number;
  grossWinR: number;
  grossLossR: number;
  profitFactor: number | null;
  maxDrawdownR: number;
  bestR: number | null;
  worstR: number | null;
};

export type ReaderHypothesisResult = {
  hypothesis: ReaderHypothesis;
  summary: ReaderHypothesisSummary;
  entries: Array<{
    candidate: ReaderCandidate;
    resultR: number;
    costR: number;
  }>;
};

export type ReaderHypothesisGroupResult = {
  key: string;
  summary: ReaderHypothesisSummary;
};

export type {
  ReaderHypothesisInspectionEntry,
  ReaderHypothesisInspectionGroup,
  ReaderHypothesisInspectionReport,
  ReaderHypothesisInspectionResult,
} from "./build-reader-hypothesis-inspection-report";

export type {
  ReaderHypothesisMonteCarloOptions,
  ReaderHypothesisMonteCarloPathStats,
  ReaderHypothesisMonteCarloReport,
  ReaderHypothesisMonteCarloResult,
} from "./build-reader-hypothesis-monte-carlo-report";

export type ReaderHypothesisReportResult = ReaderHypothesisResult & {
  byMonth: ReaderHypothesisGroupResult[];
  byFamily: ReaderHypothesisGroupResult[];
  byRegime: ReaderHypothesisGroupResult[];
};

export type ReaderHypothesisReport = {
  summary: {
    candidates: number;
    hypotheses: number;
    roundTripCostBps: number;
  };
  ranked: ReaderHypothesisReportResult[];
  bestByKind: ReaderHypothesisReportResult[];
};

export type ReaderHypothesisSweepBand = {
  min: number;
  max: number | null;
};

export type ReaderHypothesisSweepInput = {
  families?: Array<ReaderCandidateFamily | "*">;
  sides?: Array<Side | "*">;
  regimes?: string[];
  events?: string[];
  confirmationTypes?: ReaderHypothesisConfirmationType[];
  thresholdsR?: number[];
  invalidationBpsBands?: ReaderHypothesisSweepBand[];
  tradeCountBands?: ReaderHypothesisSweepBand[];
  maxAbsResultR?: number;
  minEntries?: number;
  maxEntries?: number;
  top?: number;
  includeAnyFamily?: boolean;
  includeAnySide?: boolean;
  includeAnyRegime?: boolean;
  includeAnyEvent?: boolean;
};

export type ReaderHypothesisSweepReport = {
  summary: {
    candidates: number;
    generated: number;
    kept: number;
    roundTripCostBps: number;
    minEntries: number;
    maxEntries: number | null;
  };
  ranked: ReaderHypothesisReportResult[];
  bestByKind: ReaderHypothesisReportResult[];
};

export type ReaderHypothesisStabilityGroup = {
  key: string;
  summary: ReaderHypothesisSummary;
};

export type ReaderHypothesisStabilityResult = {
  hypothesis: ReaderHypothesis;
  summary: ReaderHypothesisSummary;
  groups: ReaderHypothesisStabilityGroup[];
  positiveGroups: number;
  negativeGroups: number;
  flatGroups: number;
  profitableGroupRate: number;
  bestGroup: ReaderHypothesisStabilityGroup | null;
  worstGroup: ReaderHypothesisStabilityGroup | null;
  train: ReaderHypothesisSummary | null;
  test: ReaderHypothesisSummary | null;
};

export type ReaderHypothesisStabilityReport = {
  summary: {
    candidates: number;
    hypotheses: number;
    roundTripCostBps: number;
    splitAt: number | null;
  };
  ranked: ReaderHypothesisStabilityResult[];
};

export type ReaderHypothesisScoreOptions = ReaderHypothesisEvaluationOptions & {
  bootstrapSamples?: number;
  bootstrapSeed?: number;
  bootstrapPercentile?: number;
};

export type ReaderHypothesisPathMetrics = {
  evaluatedDays: number;
  opportunityDays: number;
  entryDays: number;
  entries: number;
  tradesPerEvaluatedDay: number;
  tradesPerEntryDay: number;
  totalR: number;
  rPerEvaluatedDay: number;
  rPerOpportunityDay: number;
  rPerTrade: number;
  winRate: number;
  winRateLowerBound: number;
  maxDrawdownR: number;
  maxDrawdownDurationDays: number;
  ulcerIndexR: number;
  painIndexR: number;
  positiveMonths: number;
  negativeMonths: number;
  flatMonths: number;
  evaluatedMonths: number;
  profitableMonthRate: number;
  worstMonthR: number | null;
};

export type ReaderHypothesisBootstrapMetrics = {
  samples: number;
  percentile: number;
  totalRLowerBound: number;
  rPerDayLowerBound: number;
  maxDrawdownRPessimistic: number;
  positiveReturnProbability: number;
};

export type ReaderHypothesisMetricRanks = {
  productivity: number;
  activity: number;
  winConfidence: number;
  risk: number;
  stability: number;
  bootstrap: number;
};

export type ReaderHypothesisScoreResult = {
  hypothesis: ReaderHypothesis;
  summary: ReaderHypothesisSummary;
  path: ReaderHypothesisPathMetrics;
  bootstrap: ReaderHypothesisBootstrapMetrics;
  paretoTier: number;
  aggregateRank: number;
  metricRanks: ReaderHypothesisMetricRanks;
};

export type ReaderHypothesisScoreReport = {
  summary: {
    candidates: number;
    hypotheses: number;
    roundTripCostBps: number;
    evaluatedDays: number;
    bootstrapSamples: number;
    bootstrapSeed: number;
    bootstrapPercentile: number;
  };
  ranked: ReaderHypothesisScoreResult[];
};

