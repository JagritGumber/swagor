import type { ReaderCandidate, ReaderCandidateTape } from "../reader-candidates/types";

export type ReaderCandidateLearnerGuidance =
  | "paper-promote-candidate"
  | "future-avoid-candidate"
  | "builder-too-strict-candidate"
  | "noise-candidate"
  | "geometry-artifact-candidate"
  | "risk-reward-artifact-candidate"
  | "thin-sample-candidate"
  | "untradeable-balance-candidate"
  | "unjudgeable-candidate";

export type ReaderCandidateTapeFile = {
  summary: ReaderCandidateTape["summary"];
  assets: Array<{
    asset: string;
    tape: ReaderCandidateTape;
  }>;
};

export type ReaderCandidateLearnerInput = {
  tapes: ReaderCandidateTapeFile[];
  minimumSampleForGuidance: number;
};

export type ReaderCandidateLearnerSummary = {
  candidates: number;
  judgeable: number;
  worked: number;
  invalidated: number;
  unresolved: number;
  unjudgeable: number;
  executed: number;
  workedRate: number;
  invalidGeometry: number;
  subRiskTarget: number;
  avgTargetR: number | null;
  avgTargetBps: number | null;
  avgInvalidationBps: number | null;
  avgResultR: number | null;
  avgFirstReactionR: number | null;
  avgMaxFavorableR: number | null;
  avgMaxAdverseR: number | null;
  medianTargetR: number | null;
  medianTargetBps: number | null;
  medianInvalidationBps: number | null;
  medianResultR: number | null;
  medianFirstReactionR: number | null;
  minInvalidationBps: number | null;
};

export type ReaderCandidateLearnerLesson = {
  key: string;
  guidance: ReaderCandidateLearnerGuidance;
  summary: ReaderCandidateLearnerSummary;
  sampleWarning: string | null;
  reasons: string[];
  refs: string[];
};

export type ReaderCandidateLearnerReport = {
  summary: ReaderCandidateLearnerSummary;
  paperPromoteCandidates: ReaderCandidateLearnerLesson[];
  futureAvoidCandidates: ReaderCandidateLearnerLesson[];
  builderTooStrictCandidates: ReaderCandidateLearnerLesson[];
  noiseCandidates: ReaderCandidateLearnerLesson[];
  geometryArtifactCandidates: ReaderCandidateLearnerLesson[];
  riskRewardArtifactCandidates: ReaderCandidateLearnerLesson[];
  thinSampleCandidates: ReaderCandidateLearnerLesson[];
  untradeableBalanceCandidates: ReaderCandidateLearnerLesson[];
  unjudgeableCandidates: ReaderCandidateLearnerLesson[];
};

export type ReaderCandidateLearnerGroup = {
  key: string;
  candidates: ReaderCandidate[];
};


