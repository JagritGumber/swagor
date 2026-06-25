import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { evaluateReaderHypothesis, evaluateReaderHypotheses } from "./evaluate-reader-hypotheses";
import type { ReaderHypothesis } from "./types";

describe("evaluateReaderHypothesis", () => {
  test("scores delayed confirmation with normalized later-entry risk", () => {
    const hypothesis: ReaderHypothesis = {
      id: "delayed",
      label: "delayed",
      description: "test",
      kind: "trend-following",
      filters: {
        family: "trend-continuation",
        minInvalidationBps: 2,
        maxInvalidationBps: 5,
        minTradeCount: 0,
        maxTradeCount: 250,
      },
      confirmation: {
        type: "max-favorable",
        thresholdR: 0.25,
      },
    };

    const result = evaluateReaderHypothesis({
      candidates: [
        candidate({ index: 1, targetR: 4, resultR: 4, maxFavorableR: 4 }),
        candidate({ index: 2, outcome: "invalidated", resultR: -1, maxFavorableR: 0.3 }),
        candidate({ index: 3, targetR: 3, resultR: 3, maxFavorableR: 0.1 }),
        candidate({ index: 4, invalidationBps: 6, targetR: 10, resultR: 10, maxFavorableR: 10 }),
      ],
      hypothesis,
    });

    expect(result.summary.candidates).toBe(3);
    expect(result.summary.entries).toBe(2);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.totalR).toBe(2);
    expect(result.summary.maxDrawdownR).toBe(-1);
  });

  test("subtracts round-trip costs using invalidation bps as the risk unit", () => {
    const hypothesis: ReaderHypothesis = {
      id: "immediate",
      label: "immediate",
      description: "test",
      kind: "mixed-reader",
      filters: {
        side: "long",
        minInvalidationBps: 2,
        maxInvalidationBps: 5,
      },
      confirmation: {
        type: "none",
        thresholdR: 0,
      },
    };

    const result = evaluateReaderHypothesis({
      candidates: [
        candidate({ index: 1, resultR: 2, invalidationBps: 4 }),
        candidate({ index: 2, outcome: "invalidated", resultR: -1, invalidationBps: 4 }),
      ],
      hypothesis,
      options: {
        roundTripCostBps: 1,
      },
    });

    expect(result.entries.map((entry) => entry.costR)).toEqual([0.25, 0.25]);
    expect(result.summary.totalR).toBe(0.5);
    expect(result.summary.grossLossR).toBe(-1.25);
  });

  test("ranks default-style hypotheses by total R", () => {
    const trend: ReaderHypothesis = {
      id: "trend",
      label: "trend",
      description: "test",
      kind: "trend-following",
      filters: { family: "trend-continuation" },
      confirmation: { type: "none", thresholdR: 0 },
    };
    const adverse: ReaderHypothesis = {
      id: "adverse",
      label: "adverse",
      description: "test",
      kind: "adverse-reader",
      filters: { family: "absorption-reaction" },
      confirmation: { type: "none", thresholdR: 0 },
    };

    const [best] = evaluateReaderHypotheses({
      candidates: [
        candidate({ index: 1, family: "trend-continuation", resultR: 1 }),
        candidate({ index: 2, family: "absorption-reaction", resultR: 3 }),
      ],
      hypotheses: [trend, adverse],
    });

    expect(best?.hypothesis.id).toBe("adverse");
    expect(best?.summary.totalR).toBe(3);
  });
});

function candidate(input: {
  index: number;
  outcome?: "worked" | "invalidated";
  family?: ReaderCandidate["family"];
  side?: ReaderCandidate["side"];
  targetR?: number;
  resultR: number;
  firstReactionR?: number | null;
  maxFavorableR?: number | null;
  invalidationBps?: number;
  tradeCount?: number;
  regime?: string | null;
  events?: string[];
}): ReaderCandidate {
  const outcome = input.outcome ?? (input.resultR > 0 ? "worked" : "invalidated");
  const targetR = input.targetR ?? (input.resultR > 0 ? input.resultR : 3);
  return {
    index: input.index,
    asset: "BTCUSDT",
    observedAt: Date.parse(`2025-05-01T00:${String(input.index).padStart(2, "0")}:00.000Z`),
    family: input.family ?? "trend-continuation",
    side: input.side ?? "long",
    entryPrice: 100,
    target: 104,
    invalidation: 99,
    reader: {
      auctionLocation: "value-low",
      auctionLevelKind: "support",
      auctionMode: "pullback",
      auctionPhase: "rotation",
      vpAuction: "inside-value",
      vpPoc: "poc-stable",
      vpValue: "value-stable",
      regime: input.regime ?? "range",
      narrativeIntent: "trend-continuation",
      narrativeDirection: "long",
      localRangeLocation: "lower-edge",
      localRangePosition: 0.2,
    },
    orderflow: {
      pressure: "sell-pressure",
      events: input.events ?? ["large-print"],
      tradeCount: input.tradeCount ?? 100,
      largestTradeSide: "sell",
    },
    builder: {
      response: "watch",
      setupFamily: null,
      reasons: [],
    },
    outcome: {
      verdict: outcome,
      firstReaction: "favorable",
      firstReactionMove: input.firstReactionR ?? 0.25,
      firstReactionR: input.firstReactionR ?? 0.25,
      targetDistance: targetR,
      invalidationDistance: 1,
      targetBps: targetR * 4,
      invalidationBps: input.invalidationBps ?? 4,
      targetR,
      maxFavorableMove: input.maxFavorableR ?? targetR,
      maxAdverseMove: outcome === "invalidated" ? -1 : 0,
      maxFavorableR: input.maxFavorableR ?? targetR,
      maxAdverseR: outcome === "invalidated" ? -1 : 0,
      resultR: input.resultR,
      reachedAt: outcome === "worked" ? Date.parse("2025-05-01T01:00:00.000Z") : null,
      invalidatedAt: outcome === "invalidated" ? Date.parse("2025-05-01T01:00:00.000Z") : null,
    },
  };
}


