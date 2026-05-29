import type { Side } from "../types";
import type { ReaderMarketRegime } from "../market-regime/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { ReaderSequencePhase } from "../reader-sequence/types";

export type ReaderTradePlanStatus = "no-trade" | "watch" | "ready-if-reclaim" | "ready";
export type ReaderSetupFamily = "none" | "reversal-reclaim" | "breakout-acceptance";

export type ReaderTradePlanConfig = Record<string, never>;

export type ReaderNoTradePlan = {
  status: "no-trade";
  asset: string;
  setupFamily?: ReaderSetupFamily;
  regime?: ReaderMarketRegime;
  sequencePhase?: ReaderSequencePhase;
  sequenceReason?: string;
  confidence: 0;
  narrative?: ReaderNarrative;
  reasons: string[];
};

export type ReaderActionableTradePlan = {
  status: "watch" | "ready-if-reclaim" | "ready";
  asset: string;
  setupFamily?: ReaderSetupFamily;
  regime?: ReaderMarketRegime;
  sequencePhase?: ReaderSequencePhase;
  sequenceReason?: string;
  side: Side;
  entryLow: number;
  entryHigh: number;
  stop: number;
  target: number;
  invalidation: string;
  confidence: number;
  narrative?: ReaderNarrative;
  reasons: string[];
};

export type ReaderTradePlan = ReaderNoTradePlan | ReaderActionableTradePlan;
