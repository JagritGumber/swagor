import type { Side } from "../types";

export type ReaderTradePlanStatus = "no-trade" | "watch" | "ready-if-reclaim" | "ready";

export type ReaderTradePlanConfig = {
  entryZoneMinPct?: number;
  watchConfidence?: number;
  readyConfidence?: number;
  largePrintConfidenceBoost?: number;
  failedPressureConfidenceBoost?: number;
};

export type ReaderNoTradePlan = {
  status: "no-trade";
  asset: string;
  confidence: 0;
  reasons: string[];
};

export type ReaderActionableTradePlan = {
  status: "watch" | "ready-if-reclaim" | "ready";
  asset: string;
  side: Side;
  entryLow: number;
  entryHigh: number;
  stop: number;
  target: number;
  invalidation: string;
  confidence: number;
  reasons: string[];
};

export type ReaderTradePlan = ReaderNoTradePlan | ReaderActionableTradePlan;
