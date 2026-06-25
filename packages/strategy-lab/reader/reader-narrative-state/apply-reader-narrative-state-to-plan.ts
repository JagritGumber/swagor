import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderActionableTradePlan, ReaderNoTradePlan, ReaderTradePlan } from "../../bt-core/trade-plan/types";
import type { ReaderNarrativeState } from "./types";

export function applyReaderNarrativeStateToPlan(input: {
  read: LiveReaderRead;
  plan: ReaderTradePlan;
  state: ReaderNarrativeState | null;
}): ReaderTradePlan {
  if (!isActionable(input.plan) || !input.state) return input.plan;

  if (input.state.status === "invalidated" || input.state.status === "wrong-for-session") {
    return noTrade(input.read, input.plan, [
      `narrative thesis is ${input.state.status}`,
      ...input.state.reasons,
    ]);
  }

  if (input.state.status === "deteriorating" && input.plan.status === "ready") {
    return {
      ...input.plan,
      status: "ready-if-reclaim",
      reasons: [
        "narrative thesis is deteriorating; direct ready entry is blocked",
        ...input.plan.reasons,
        ...input.state.reasons,
      ],
    };
  }

  return input.plan;
}

function isActionable(plan: ReaderTradePlan): plan is ReaderActionableTradePlan {
  return plan.status !== "no-trade";
}

function noTrade(read: LiveReaderRead, plan: ReaderActionableTradePlan, reasons: string[]): ReaderNoTradePlan {
  return {
    status: "no-trade",
    asset: plan.asset,
    setupFamily: plan.setupFamily,
    regime: plan.regime ?? read.regime,
    sequencePhase: plan.sequencePhase,
    sequenceReason: plan.sequenceReason,
    confidence: 0,
    narrative: plan.narrative ?? read.narrativeRead,
    reasons: [...new Set(reasons.filter(Boolean))],
  };
}


