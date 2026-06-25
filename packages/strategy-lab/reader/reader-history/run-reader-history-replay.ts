import { runReaderReplay } from "../reader-replay/run-reader-replay";
import { buildReaderHistoryReads } from "./build-reader-history-reads";
import type { ReaderHistoryReplayInput, ReaderHistoryReplayResult } from "./types";

export function runReaderHistoryReplay(input: ReaderHistoryReplayInput): ReaderHistoryReplayResult {
  const historySteps = buildReaderHistoryReads(input);
  const replay = runReaderReplay({
    ...input.replay,
    reads: historySteps,
    requireTimestamps: true,
  });
  return {
    ...replay,
    historySteps,
  };
}



