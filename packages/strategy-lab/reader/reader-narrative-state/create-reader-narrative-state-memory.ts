import { createMemoryStore } from "@packages/shared";
import type { ReaderNarrativeStateMemory } from "./types";

export function createReaderNarrativeStateMemory(): ReaderNarrativeStateMemory {
  return createMemoryStore();
}



