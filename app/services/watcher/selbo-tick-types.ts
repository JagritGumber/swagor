import type { MarketFeatureSnapshot } from "@/lib/market-features";
import type { RiskSnapshot } from "@/app/services/risk-engine.service";
import type { TrendRegimeSnapshot } from "@/lib/trend-regime";

/**
 * Shared decision types for Selbo's trade loop. The decision itself is made
 * by the LLM agent (selbo-agent-decision.ts); these types describe its input
 * and output. Kept separate from any engine so live + backtest import one
 * stable contract.
 */
export type AssetPressure = {
  asset: string;
  pressure: "bullish" | "bearish" | "neutral" | "risk_warning";
  confidence: number;
  reason: string;
  source?: "news" | "macro" | "regulatory" | "social" | "memory";
};

export type ExternalPressureSnapshot = {
  generatedAt?: string;
  marketMood?: "risk_on" | "risk_off" | "neutral" | "event_risk";
  assetPressure?: AssetPressure[];
  shockEvents?: Array<{
    title: string;
    affectedAssets: string[];
    impact: "bullish" | "bearish" | "risk_warning" | "ignore";
    reason: string;
  }>;
  watcherWarnings?: string[];
  memoryUsed?: string[];
  trendRegime?: TrendRegimeSnapshot;
};

export type PositionSnapshot = {
  asset: string;
  side: "long" | "short" | "unknown";
  entryPrice: number | null;
  markPrice: number | null;
  sizeUsd?: number | null;
  openedAt?: string | null;
};

export type WatcherExecutionState = {
  dailyTradeCount: number;
  dailyLossCount: number;
  dailyRealizedPnlUsd: number;
  assetSideCooldownUntil: Record<string, string>;
};

export type CadenceDecision = {
  nextCheckSeconds: number;
  state: "dormant" | "normal_scan" | "active_watch" | "position_protection" | "event_shock";
  reason: string;
};

export type WatcherDecision = {
  action: "hold" | "open_long" | "open_short" | "close" | "call_swarm" | "risk_emergency";
  asset: string | null;
  reason: string;
  marketTrigger: "val_reclaim" | "vah_rejection" | "poc_acceptance" | "sweep_reclaim" | "range_break" | "risk_exit" | "none";
  externalPressure: "aligned" | "contradicted" | "neutral" | "unknown";
  confidence: number;
  cadence: CadenceDecision;
  sizeUsd: number;
  leverage: number;
  stopLossPriceUsd: number | null;
  takeProfitPriceUsd: number | null;
  blockedReasons: string[];
};

export type SelboTickInput = {
  mode: "live" | "backtest";
  asOf: string;
  strategyText: string;
  externalSentiment: ExternalPressureSnapshot | null;
  marketFeatures: MarketFeatureSnapshot;
  positions: PositionSnapshot[];
  risk: RiskSnapshot;
  recentLessons: string[];
  executionState: WatcherExecutionState;
};
