import { createMemoryStore } from "../../shared";
import type { ReaderNarrativeStateMemory } from "./types";

export function createReaderNarrativeStateMemory(): ReaderNarrativeStateMemory {
  return createMemoryStore();
}
