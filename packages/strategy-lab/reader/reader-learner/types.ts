export type ReaderLearnerGuidance =
  | "candidate-allow"
  | "avoid"
  | "reduce-size"
  | "needs-more-sample";

export type ReaderTradeTape = {
  run: {
    venue: string;
    dataMode: string;
    bucketEventMode: string;
    narrativeSessionMode: string;
    interval: string;
    startAt: string;
    endAt: string;
  };
  summary: ReaderTradeTapeSummary;
  assets: ReaderTradeTapeAsset[];
};

export type ReaderTradeTapeSummary = {
  registeredTrades: number;
  judgeableTrades: number;
  unjudgeableTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
};

export type ReaderTradeTapeAsset = {
  asset: string;
  status: string;
  summary: ReaderTradeTapeSummary;
  trades: ReaderTradeTapeTrade[];
};

export type ReaderTradeTapeTrade = {
  index: number;
  asset: string;
  entryAt: string;
  side: "long" | "short";
  setupFamily: string | null;
  trust: boolean;
  trustReason: string;
  result: {
    entryPrice: number;
    stop: number;
    target: number;
    exitReason: string | null;
    exitAt: string | null;
    exitPrice: number | null;
    r: number | null;
  };
  readerState: {
    regime: string | null;
    auctionLocation: string | null;
    auctionLevelKind: string | null;
    auctionMode: string | null;
    auctionPhase: string | null;
    sequencePhase: string | null;
    setupPlanSource: string;
    setupAgeMs: number | null;
    setupReadCount: number | null;
  };
  narrative: {
    intent: string | null;
    direction: string | null;
    participation: string | null;
    verdict: string;
    key: string;
    invalidatingEvidence: string[];
  };
  vp: {
    auction: string | null;
    poc: string | null;
    value: string | null;
  };
  orderflow: {
    pressure: string;
    events: string[];
    tradeCount: number;
  };
  diagnostics: {
    firstReaction: string;
    firstReactionR: number | null;
    observedMfeR: number | null;
    observedMaeR: number | null;
    timeInTradeMs: number | null;
    pricedReadsAfterEntry: number;
    entryTiming: string;
    pocRotation: string;
    labels: string[];
  };
  reviewVerdict: string | null;
  reviewNotes: string | null;
  dossierVerdict: string;
};

export type ReaderLearnerConfig = {
  minimumSampleForGuidance?: number;
};

export type ReaderLearnerInput = ReaderLearnerConfig & {
  tapes: ReaderTradeTape[];
};

export type ReaderLearnerSummary = ReaderTradeTapeSummary & {
  winRate: number;
};

export type ReaderLearnerLesson = {
  key: string;
  outcomeKey: string | null;
  guidance: ReaderLearnerGuidance;
  summary: ReaderLearnerSummary;
  sampleWarning: string | null;
  reasons: string[];
  tradeRefs: string[];
};

export type ReaderLearnerReport = {
  summary: ReaderLearnerSummary;
  playbookLessons: ReaderLearnerLesson[];
  avoidLessons: ReaderLearnerLesson[];
  scaleLessons: ReaderLearnerLesson[];
  sampleWarnings: ReaderLearnerLesson[];
  dataQualityLessons: ReaderLearnerLesson[];
};

export type ReaderLearnerReplayDecision =
  | "kept"
  | "skipped-future-avoid"
  | "kept-reduce-size-candidate"
  | "kept-needs-more-sample";

export type ReaderLearnerReplayTrade = {
  trade: ReaderTradeTapeTrade;
  decision: ReaderLearnerReplayDecision;
  lessonKey: string | null;
  reasons: string[];
};

export type ReaderLearnerReplayReport = {
  baseline: ReaderLearnerSummary;
  learned: ReaderLearnerSummary;
  skipped: ReaderLearnerSummary;
  trades: ReaderLearnerReplayTrade[];
};



