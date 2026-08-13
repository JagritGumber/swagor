import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderResultUpdate } from "../reader-result/types";
import type { ReaderHistoryStep } from "../reader-history/types";
import type { Side } from "@strategy-lab/types";

export type ReaderCandidateFamily =
  | "poc-chop-no-trade"
  | "value-high-reaction"
  | "value-low-reaction"
  | "initiative-continuation"
  | "trend-continuation"
  | "absorption-reaction";

export type ReaderCandidateBuilderResponse =
  | "no-trade"
  | "watch"
  | "ready-if-reclaim"
  | "ready"
  | "executed";

export type ReaderCandidateOutcome =
  | "worked"
  | "invalidated"
  | "unresolved"
  | "unjudgeable";

export type ReaderCandidate = {
  index: number;
  asset: string;
  observedAt: number;
  family: ReaderCandidateFamily;
  side: Side | null;
  entryPrice: number | null;
  target: number | null;
  invalidation: number | null;
  reader: {
    auctionLocation: string;
    auctionLevelKind: string | null;
    auctionMode: string | null;
    auctionPhase: string | null;
    vpAuction: string | null;
    vpPoc: string | null;
    vpValue: string | null;
    regime: string | null;
    narrativeIntent: string | null;
    narrativeDirection: string | null;
    localRangeLocation: string | null;
    localRangePosition: number | null;
  };
  orderflow: {
    pressure: string;
    events: string[];
    tradeCount: number;
    largestTradeSide: string | null;
  };
  builder: {
    response: ReaderCandidateBuilderResponse;
    setupFamily: string | null;
    reasons: string[];
  };
  outcome: {
    verdict: ReaderCandidateOutcome;
    firstReaction: "favorable" | "adverse" | "flat" | "none";
    firstReactionMove: number | null;
    firstReactionR: number | null;
    targetDistance: number | null;
    invalidationDistance: number | null;
    targetBps: number | null;
    invalidationBps: number | null;
    targetR: number | null;
    maxFavorableMove: number | null;
    maxAdverseMove: number | null;
    maxFavorableR: number | null;
    maxAdverseR: number | null;
    resultR: number | null;
    reachedAt: number | null;
    invalidatedAt: number | null;
  };
};

export type ReaderCandidateTape = {
  summary: {
    candidates: number;
    directional: number;
    nonDirectional: number;
    worked: number;
    invalidated: number;
    unresolved: number;
    unjudgeable: number;
    executed: number;
  };
  candidates: ReaderCandidate[];
};

export type BuildReaderCandidateTapeInput = {
  historySteps: ReaderHistoryStep[];
  setupResults: ReaderSetupResult[];
  resultUpdates: ReaderResultUpdate[];
};



