import type { ReaderActionableTradePlan } from "@strategy-lab/backtest/trade-plan/types";
import type { ReaderSequence } from "./types";

export function sequenceForPlan(plan: ReaderActionableTradePlan): ReaderSequence {
  if (plan.setupFamily === "breakout-acceptance") {
    return {
      family: "breakout-acceptance",
      phase: "breakout-closed",
      reason: "breakout candle closed outside level; waiting for next read acceptance",
    };
  }
  if (plan.setupFamily === "trend-continuation") {
    return {
      family: "trend-continuation",
      phase: "breakout-closed",
      reason: "trend continuation accepted value migration; waiting for next read acceptance",
    };
  }
  if (plan.status === "ready-if-reclaim") {
    return {
      family: "reversal-reclaim",
      phase: "failed-pressure",
      reason: "failed pressure observed; waiting for reclaim",
    };
  }
  return {
    family: "reversal-reclaim",
    phase: "observing",
    reason: "reversal context observed; waiting for failed pressure and reclaim",
  };
}

export function blocksImmediateEntry(phase: ReaderSequence["phase"]): boolean {
  return phase !== "trade-ready";
}



