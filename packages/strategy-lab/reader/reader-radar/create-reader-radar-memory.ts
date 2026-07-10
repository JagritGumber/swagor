import { createMemoryStore, type MemoryConfig } from "@packages/shared";
import type { ReaderRadarCandidate, ReaderRadarMemory } from "./types";

export function createReaderRadarMemory(config: MemoryConfig<ReaderRadarCandidate> = {}): ReaderRadarMemory {
  return createMemoryStore<ReaderRadarCandidate>(config);
}



