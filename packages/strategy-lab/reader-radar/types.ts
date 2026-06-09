import type { MemoryStore } from "../../shared";
import type { ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderActionableTradePlan, ReaderTradeStyle } from "../trade-plan/types";

export type ReaderRadarMode = "shadow" | "execute";

export type ReaderRadarStatus =
  | "watching"
  | "improving"
  | "deteriorating"
  | "promoted"
  | "killed"
  | "expired";

export type ReaderRadarConfig = {
  mode: ReaderRadarMode;
  maxStaleMs?: number | null;
  tradeStyle?: ReaderTradeStyle;
};

export type ReaderRadarCandidate = {
  key: string;
  asset: string;
  status: ReaderRadarStatus;
  candidate: ReaderCandidateDraft;
  planSnapshot: ReaderActionableTradePlan | null;
  anchorPrice: number | null;
  createdAt: number;
  updatedAt: number;
  lastReadAt: number;
  readCount: number;
  favorableReads: number;
  adverseReads: number;
  repairReads: number;
  invalidationEvidence: string[];
  pocDistance: number | null;
  previousPocDistance: number | null;
  pocRotation: "toward-poc" | "away-from-poc" | "through-poc" | "no-poc";
  lastMove: number;
  bestMove: number;
  worstMove: number;
  lastReason: string;
};

export type ReaderRadarMemory = MemoryStore<ReaderRadarCandidate>;

export type ReaderRadarEventType =
  | "radar-born"
  | "radar-updated"
  | "radar-improved"
  | "radar-deteriorated"
  | "radar-promoted"
  | "radar-blocked"
  | "radar-killed"
  | "radar-expired"
  | "radar-ignored";

export type ReaderRadarEvent = {
  type: ReaderRadarEventType;
  key: string;
  asset: string;
  at: number;
  reason: string;
};

export type ReaderRadarUpdate = {
  setup: ReaderSetupResult;
  candidate: ReaderRadarCandidate | null;
  events: ReaderRadarEvent[];
  promoted: boolean;
};
