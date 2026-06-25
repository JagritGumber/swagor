import { createReaderResultState } from "../reader-result/create-reader-result-state";
import { updateReaderResult } from "../reader-result/update-reader-result";
import { createReaderNarrativeStateMemory } from "../reader-narrative-state/create-reader-narrative-state-memory";
import { updateReaderNarrativeState } from "../reader-narrative-state/update-reader-narrative-state";
import { createReaderRadarMemory } from "../reader-radar/create-reader-radar-memory";
import { updateReaderRadar } from "../reader-radar/update-reader-radar";
import type { ReaderRadarEvent, ReaderRadarUpdate } from "../reader-radar/types";
import { createReaderSetupMemory } from "../reader-setup/create-reader-setup-memory";
import { readMarketSetup } from "../reader-setup/read-market-setup";
import { summarizeReaderOutcomes } from "./summarize-reader-outcomes";
import type { ReaderReplayInput, ReaderReplayResult } from "./types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultState, ReaderResultUpdate } from "../reader-result/types";
import type { ReaderSetupEvent, ReaderSetupResult } from "../reader-setup/types";

export function runReaderReplay(input: ReaderReplayInput): ReaderReplayResult {
  const setupMemory = input.setupMemory ?? createReaderSetupMemory({ ttlMs: input.setupConfig?.setupTtlMs ?? undefined });
  const radarMemory = input.radarConfig ? input.radarMemory ?? createReaderRadarMemory() : null;
  const narrativeMemory = input.setupConfig?.narrativeState?.memory ?? createReaderNarrativeStateMemory();
  const resultState = input.resultState ?? createReaderResultState({ maxEvents: input.resultMaxEvents });
  const setupConfig = {
    ...input.setupConfig,
    narrativeState: {
      ...input.setupConfig?.narrativeState,
      memory: narrativeMemory,
    },
  };
  const setupResults: ReaderSetupResult[] = [];
  const setupEvents: ReaderSetupEvent[] = [];
  const radarUpdates: ReaderRadarUpdate[] = [];
  const radarEvents: ReaderRadarEvent[] = [];
  const resultUpdates: ReaderResultUpdate[] = [];
  const resultEvents: ReaderResultEvent[] = [];
  const entries: ReaderResultEntry[] = [];
  const initialOutcomeCount = resultState.outcomes.length;
  const initialOpen = resultState.open;

  for (const [index, stepInput] of input.reads.entries()) {
    const step = replayStepFor(
      stepInput,
      index,
      input.requireTimestamps ?? Boolean(input.setupConfig?.setupTtlMs || input.radarConfig?.maxStaleMs),
    );
    let setup = readMarketSetup({
      read: step.read,
      memory: setupMemory,
      now: step.now,
      config: setupConfig,
    });
    if (input.radarConfig && radarMemory) {
      const radarUpdate = updateReaderRadar({
        setup,
        memory: radarMemory,
        config: input.radarConfig,
        now: step.now,
      });
      setup = radarUpdate.setup;
      radarUpdates.push(radarUpdate);
      radarEvents.push(...radarUpdate.events);
    }
    const resultUpdate = updateReaderResult({
      state: resultState,
      result: setup,
      now: step.now,
    });

    setupResults.push(setup);
    setupEvents.push(...setup.events);
    resultUpdates.push(snapshotResultUpdate(resultUpdate));
    resultEvents.push(...resultUpdate.events);
    if (resultUpdate.opened) entries.push(resultUpdate.opened);
    if (resultUpdate.closed && setupConfig.narrativeState?.enabled !== false) {
      updateReaderNarrativeState({
        memory: narrativeMemory,
        outcome: resultUpdate.closed,
        now: step.now,
        ttlMs: setupConfig.narrativeState?.ttlMs,
      });
    }
  }

  const outcomes = resultState.outcomes.slice(initialOutcomeCount);
  return {
    setupResults,
    setupEvents,
    radarUpdates,
    radarEvents,
    resultUpdates,
    resultEvents,
    entries,
    outcomes,
    open: resultState.open,
    summary: summarizeReaderOutcomes({
      totalReads: input.reads.length,
      totalEntries: entries.length + (initialOpen ? 1 : 0),
      entriesOpened: entries.length,
      outcomes,
    }),
    setupMemory,
    radarMemory,
    narrativeMemory,
    resultState,
  };
}

function snapshotResultUpdate(update: ReaderResultUpdate): ReaderResultUpdate {
  return {
    ...update,
    state: snapshotResultState(update.state),
    events: [...update.events],
  };
}

function snapshotResultState(state: ReaderResultState): ReaderResultState {
  return {
    open: state.open ? { ...state.open, reasons: [...state.open.reasons] } : null,
    outcomes: state.outcomes.map((outcome) => ({ ...outcome, reasons: [...outcome.reasons] })),
    events: [...state.events],
    maxEvents: state.maxEvents,
  };
}

function replayStepFor(stepInput: ReaderReplayInput["reads"][number], index: number, requireTimestamp: boolean) {
  if ("read" in stepInput) return stepInput;
  if (requireTimestamp) {
    throw new Error("reader replay requires explicit now timestamps when TTL-sensitive replay is enabled");
  }
  return { read: stepInput, now: index + 1 };
}



