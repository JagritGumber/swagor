import { createMemoryStore, type MemoryConfig } from "../../../shared";
import type { ReaderRadarCandidate, ReaderRadarMemory } from "./types";

export function createReaderRadarMemory(config: MemoryConfig<ReaderRadarCandidate> = {}): ReaderRadarMemory {
  return createMemoryStore<ReaderRadarCandidate>(config);
}



