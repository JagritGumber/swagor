import type { MemoryStore } from "../../../shared";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderNarrativeStateConfig } from "../reader-narrative-state/types";
import type { ReaderSequence } from "../reader-sequence/types";
import type { Side } from "../../types";
import type { ReaderActionableTradePlan, ReaderTradePlan, ReaderTradePlanConfig } from "../../backtest/trade-plan/types";

export type ReaderSetupStatus = "watching" | "waiting-reclaim" | "ready";

export type ReaderSetupState = {
  key: string;
  scope: string | null;
  asset: string;
  interval: string;
  side: Side;
  status: ReaderSetupStatus;
  sequence?: ReaderSequence;
  plan: ReaderActionableTradePlan;
  createdAt: number;
  updatedAt: number;
  lastReadAt: number;
  readCount: number;
  lastReason: string;
};

export type ReaderSetupMemory = MemoryStore<ReaderSetupState>;

export type ReaderSetupConfig = {
  tradePlanConfig?: ReaderTradePlanConfig;
  narrativeState?: ReaderNarrativeStateConfig;
  setupTtlMs?: number | null;
  keyScope?: string;
};

export type ReaderSetupEventType =
  | "setup-created"
  | "setup-replaced"
  | "setup-held"
  | "setup-ready"
  | "setup-invalidated"
  | "setup-expired"
  | "setup-none";

export type ReaderSetupEvent = {
  type: ReaderSetupEventType;
  key: string;
  asset: string;
  at: number;
  reason: string;
};

export type ReaderSetupResult = {
  read: LiveReaderRead;
  plan: ReaderTradePlan;
  setup: ReaderSetupState | null;
  events: ReaderSetupEvent[];
  planSource: "fresh-read" | "memory-held" | "memory-promoted" | "none";
  narrativeStateConfig?: ReaderNarrativeStateConfig;
};



