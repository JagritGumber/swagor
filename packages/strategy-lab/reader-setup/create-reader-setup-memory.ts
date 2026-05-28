import { createMemoryStore, type MemoryConfig } from "../../shared";
import type { ReaderSetupState } from "./types";

export function createReaderSetupMemory(config: MemoryConfig<ReaderSetupState> = {}) {
  return createMemoryStore<ReaderSetupState>(config);
}
