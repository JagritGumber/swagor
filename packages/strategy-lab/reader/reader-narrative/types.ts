import type { Side } from "@strategy-lab/types";

export type ReaderNarrativeIntent =
  | "wait"
  | "breakout-watch"
  | "breakout-continuation"
  | "trend-continuation"
  | "reversal-watch"
  | "reversal-reclaim"
  | "continuation-pullback";

export type ReaderNarrativeParticipation =
  | "drying"
  | "balanced"
  | "initiative-buying"
  | "initiative-selling"
  | "absorption"
  | "unknown";

export type ReaderNarrativeLevelStory =
  | "accepting-above"
  | "accepting-below"
  | "rejecting-above"
  | "rejecting-below"
  | "inside-value"
  | "no-level";

export type ReaderNarrative = {
  intent: ReaderNarrativeIntent;
  direction: Side | "none";
  participation: ReaderNarrativeParticipation;
  levelStory: ReaderNarrativeLevelStory;
  reasons: string[];
  invalidation: string | null;
  target: string | null;
};



