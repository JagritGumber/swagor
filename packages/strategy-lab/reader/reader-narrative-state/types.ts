import type { MemoryStore } from "../../../shared";
import type { ReaderSessionConfig } from "../reader-session/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { ReaderActionableTradePlan } from "../../bt-core/trade-plan/types";

export type ReaderNarrativeStateStatus =
  | "forming"
  | "confirmed"
  | "deteriorating"
  | "invalidated"
  | "wrong-for-session";

export type ReaderNarrativeState = {
  key: string;
  asset: string;
  session: string;
  narrative: ReaderNarrative;
  status: ReaderNarrativeStateStatus;
  confirmations: number;
  invalidations: number;
  lastOutcomeR: number | null;
  lastUpdatedAt: number;
  reasons: string[];
};

export type ReaderNarrativeStateMemory = MemoryStore<ReaderNarrativeState>;

export type ReaderNarrativeSessionMode = "utc-day" | "rolling" | "liquidity-session";

export type ReaderNarrativeStateConfig = {
  enabled?: boolean;
  memory?: ReaderNarrativeStateMemory;
  ttlMs?: number | null;
  sessionMode?: ReaderNarrativeSessionMode;
  session?: ReaderSessionConfig;
};

export type ReaderNarrativeKeyInput = {
  asset: string;
  at: number;
  narrative?: ReaderNarrative;
  auction: {
    location: string;
    levelKind: string | null;
  };
  sessionMode?: ReaderNarrativeSessionMode;
  session?: ReaderSessionConfig;
};

export type ReaderNarrativeStatePlanInput = {
  plan: ReaderActionableTradePlan;
  state: ReaderNarrativeState | null;
};


