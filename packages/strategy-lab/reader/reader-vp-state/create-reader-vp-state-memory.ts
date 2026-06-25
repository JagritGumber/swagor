import type { ReaderVpStateMemory } from "./types";

export function createReaderVpStateMemory(): ReaderVpStateMemory {
  return {
    previousProfile: null,
    previousLocation: null,
    previousAuction: null,
  };
}



