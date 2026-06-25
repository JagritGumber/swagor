import type { ReaderSetupFamily } from "../bt-core/trade-plan/types";

export type ReaderSequencePhase =
  | "observing"
  | "breakout-closed"
  | "failed-pressure"
  | "reclaimed"
  | "trade-ready";

export type ReaderSequence = {
  family: Exclude<ReaderSetupFamily, "none">;
  phase: ReaderSequencePhase;
  reason: string;
};
