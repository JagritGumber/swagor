import type { MemoryStore } from "../../shared";
import type { ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";
import type { ReaderSetupResult } from "../reader-setup/types";

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
};

export type ReaderRadarCandidate = {
  key: string;
  asset: string;
  status: ReaderRadarStatus;
  candidate: ReaderCandidateDraft;
  createdAt: number;
  updatedAt: number;
  lastReadAt: number;
  readCount: number;
  favorableReads: number;
  adverseReads: number;
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
