import type { ReaderResultOutcome } from "../reader-result/types";
import type { ReaderNarrativeState, ReaderNarrativeStateMemory, ReaderNarrativeStateStatus } from "./types";

export function updateReaderNarrativeState(input: {
  memory: ReaderNarrativeStateMemory;
  outcome: ReaderResultOutcome;
  now?: number;
  ttlMs?: number | null;
}): ReaderNarrativeState | null {
  const key = input.outcome.narrativeKey;
  const narrative = input.outcome.narrative;
  if (!key || !narrative) return null;
  const now = input.now ?? input.outcome.exitAt;
  const event = input.memory.update(key, (current) => {
    const previous = current?.value;
    const confirmations = input.outcome.r > 0 ? (previous?.confirmations ?? 0) + 1 : previous?.confirmations ?? 0;
    const invalidations = input.outcome.r < 0 ? (previous?.invalidations ?? 0) + 1 : 0;
    return {
      key,
      asset: input.outcome.asset,
      session: key.split("|")[1] ?? new Date(input.outcome.entryAt).toISOString().slice(0, 10),
      narrative,
      status: statusFor({ r: input.outcome.r, confirmations, invalidations }),
      confirmations,
      invalidations,
      lastOutcomeR: input.outcome.r,
      lastUpdatedAt: now,
      reasons: reasonsFor(input.outcome.r, invalidations),
    };
  }, { now, ttlMs: input.ttlMs, reason: `trade closed ${input.outcome.exitReason}` });
  return event.entry?.value ?? null;
}

function statusFor(input: {
  r: number;
  confirmations: number;
  invalidations: number;
}): ReaderNarrativeStateStatus {
  if (input.r > 0) return "confirmed";
  if (input.invalidations >= 3) return "wrong-for-session";
  if (input.invalidations >= 2) return "invalidated";
  if (input.invalidations === 1) return "deteriorating";
  if (input.confirmations > 0) return "confirmed";
  return "forming";
}

function reasonsFor(r: number, invalidations: number): string[] {
  if (r > 0) return ["narrative thesis was confirmed by target hit"];
  if (invalidations >= 3) return ["same narrative thesis failed three times this session"];
  if (invalidations >= 2) return ["same narrative thesis failed twice this session"];
  return ["narrative thesis failed once this session"];
}



