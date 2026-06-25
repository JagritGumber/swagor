import type { ReaderResultState } from "./types";

export function createReaderResultState(config: { maxEvents?: number } = {}): ReaderResultState {
  return {
    open: null,
    outcomes: [],
    events: [],
    maxEvents: config.maxEvents ?? 500,
  };
}



