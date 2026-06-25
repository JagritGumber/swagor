import type { ReaderCandidate, ReaderCandidateFamily } from "../reader-candidates/types";
import type { Side } from "../../types";

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


