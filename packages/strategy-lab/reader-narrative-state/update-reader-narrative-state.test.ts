import { describe, expect, test } from "bun:test";
import { createReaderNarrativeStateMemory } from "./create-reader-narrative-state-memory";
import { updateReaderNarrativeState } from "./update-reader-narrative-state";
import type { ReaderResultOutcome } from "../reader-result/types";

describe("updateReaderNarrativeState", () => {
  test("one failed thesis becomes deteriorating", () => {
    const memory = createReaderNarrativeStateMemory();
    const state = updateReaderNarrativeState({ memory, outcome: outcome(-1) });

    expect(state?.status).toBe("deteriorating");
    expect(state?.invalidations).toBe(1);
  });

  test("two same-session failures invalidate the thesis", () => {
    const memory = createReaderNarrativeStateMemory();
    updateReaderNarrativeState({ memory, outcome: outcome(-1) });
    const state = updateReaderNarrativeState({ memory, outcome: outcome(-1) });

    expect(state?.status).toBe("invalidated");
    expect(state?.invalidations).toBe(2);
  });

  test("three same-session failures mark the thesis wrong for session", () => {
    const memory = createReaderNarrativeStateMemory();
    updateReaderNarrativeState({ memory, outcome: outcome(-1) });
    updateReaderNarrativeState({ memory, outcome: outcome(-1) });
    const state = updateReaderNarrativeState({ memory, outcome: outcome(-1) });

    expect(state?.status).toBe("wrong-for-session");
    expect(state?.invalidations).toBe(3);
  });

  test("target hit confirms and clears invalidations", () => {
    const memory = createReaderNarrativeStateMemory();
    updateReaderNarrativeState({ memory, outcome: outcome(-1) });
    const state = updateReaderNarrativeState({ memory, outcome: outcome(2) });

    expect(state?.status).toBe("confirmed");
    expect(state?.confirmations).toBe(1);
    expect(state?.invalidations).toBe(0);
  });
});

function outcome(r: number): ReaderResultOutcome {
  return {
    asset: "BTC",
    setupKey: "BTC|5m",
    setupFamily: "reversal-reclaim",
    side: "long",
    entryPrice: 100,
    entryAt: Date.parse("2025-05-01T00:00:00.000Z"),
    stop: 99,
    target: 102,
    confidence: 0,
    narrative: {
      intent: "reversal-reclaim",
      direction: "long",
      participation: "absorption",
      levelStory: "rejecting-below",
      reasons: ["test"],
      invalidation: null,
      target: null,
    },
    narrativeKey: "BTC|2025-05-01|reversal-reclaim|long|absorption|rejecting-below|value-low|support",
    reasons: [],
    exitPrice: r > 0 ? 102 : 99,
    exitAt: Date.parse("2025-05-01T00:05:00.000Z"),
    exitReason: r > 0 ? "target" : "stop",
    r,
  };
}
