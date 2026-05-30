import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome, ReaderResultState, ReaderResultUpdate } from "../reader-result/types";
import type { ReaderNarrativeStateMemory } from "../reader-narrative-state/types";
import type { ReaderSetupConfig, ReaderSetupEvent, ReaderSetupMemory, ReaderSetupResult } from "../reader-setup/types";

export type ReaderReplayStep = LiveReaderRead | {
  read: LiveReaderRead;
  now: number;
};

export type ReaderReplaySummary = {
  totalReads: number;
  /**
   * Entries participating in this replay window, including an injected open
   * entry resumed from prior state.
   */
  totalEntries: number;
  /**
   * Entries opened by this replay run only.
   */
  entriesOpened: number;
  totalOutcomes: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
};

export type ReaderReplayInput = {
  reads: ReaderReplayStep[];
  setupConfig?: ReaderSetupConfig;
  setupMemory?: ReaderSetupMemory;
  resultState?: ReaderResultState;
  resultMaxEvents?: number;
  requireTimestamps?: boolean;
};

export type ReaderReplayResult = {
  setupResults: ReaderSetupResult[];
  setupEvents: ReaderSetupEvent[];
  resultUpdates: ReaderResultUpdate[];
  resultEvents: ReaderResultEvent[];
  entries: ReaderResultEntry[];
  outcomes: ReaderResultOutcome[];
  open: ReaderResultEntry | null;
  summary: ReaderReplaySummary;
  setupMemory: ReaderSetupMemory;
  narrativeMemory: ReaderNarrativeStateMemory;
  resultState: ReaderResultState;
};
