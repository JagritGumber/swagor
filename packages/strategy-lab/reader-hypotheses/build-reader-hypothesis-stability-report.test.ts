import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { buildReaderHypothesisStabilityReport } from "./build-reader-hypothesis-stability-report";
import type { ReaderHypothesis } from "./types";

describe("buildReaderHypothesisStabilityReport", () => {
  test("summarizes monthly stability and train/test split", () => {
    const hypothesis: ReaderHypothesis = {
      id: "trend",
      label: "trend",
      description: "test",
      kind: "trend-following",
      filters: { family: "trend-continuation" },
      confirmation: { type: "none", thresholdR: 0 },
    };

    const report = buildReaderHypothesisStabilityReport({
      candidates: [
        candidate({ index: 1, observedAt: Date.parse("2025-06-01T00:00:00.000Z"), resultR: 3 }),
        candidate({ index: 2, observedAt: Date.parse("2025-07-01T00:00:00.000Z"), resultR: -1 }),
        candidate({ index: 3, observedAt: Date.parse("2025-09-01T00:00:00.000Z"), resultR: 2 }),
      ],
      hypotheses: [hypothesis],
      splitAt: Date.parse("2025-09-01T00:00:00.000Z"),
    });

    const result = report.ranked[0];
    expect(report.summary.splitAt).toBe(Date.parse("2025-09-01T00:00:00.000Z"));
    expect(result?.summary.totalR).toBe(4);
    expect(result?.groups.map((group) => [group.key, group.summary.totalR])).toEqual([
      ["2025-06", 3],
      ["2025-09", 2],
      ["2025-07", -1],
    ]);
    expect(result?.positiveGroups).toBe(2);
    expect(result?.negativeGroups).toBe(1);
    expect(result?.profitableGroupRate).toBe(0.6667);
    expect(result?.train?.totalR).toBe(2);
    expect(result?.test?.totalR).toBe(2);
  });

  test("applies cost options to stability groups", () => {
    const hypothesis: ReaderHypothesis = {
      id: "trend",
      label: "trend",
      description: "test",
      kind: "trend-following",
      filters: { family: "trend-continuation" },
      confirmation: { type: "none", thresholdR: 0 },
    };

    const report = buildReaderHypothesisStabilityReport({
      candidates: [
        candidate({ index: 1, resultR: 2, invalidationBps: 4 }),
        candidate({ index: 2, resultR: -1, invalidationBps: 4 }),
      ],
      hypotheses: [hypothesis],
      options: { roundTripCostBps: 1 },
    });

    expect(report.summary.roundTripCostBps).toBe(1);
    expect(report.ranked[0]?.summary.totalR).toBe(0.5);
    expect(report.ranked[0]?.groups[0]?.summary.totalR).toBe(0.5);
  });
});

function candidate(input: {
  index: number;
  resultR: number;
  observedAt?: number;
  family?: ReaderCandidate["family"];
  invalidationBps?: number;
}): ReaderCandidate {
  const outcome = input.resultR > 0 ? "worked" : "invalidated";
  const targetR = input.resultR > 0 ? input.resultR : 3;
  return {
    index: input.index,
    asset: "BTCUSDT",
    observedAt: input.observedAt ?? Date.parse(`2025-05-01T00:${String(input.index).padStart(2, "0")}:00.000Z`),
    family: input.family ?? "trend-continuation",
    side: "long",
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
      regime: "range",
      narrativeIntent: "trend-continuation",
      narrativeDirection: "long",
      localRangeLocation: "lower-edge",
      localRangePosition: 0.2,
    },
    orderflow: {
      pressure: "sell-pressure",
      events: ["large-print"],
      tradeCount: 100,
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
      firstReactionMove: 0.25,
      firstReactionR: 0.25,
      targetDistance: targetR,
      invalidationDistance: 1,
      targetBps: targetR * 4,
      invalidationBps: input.invalidationBps ?? 4,
      targetR,
      maxFavorableMove: targetR,
      maxAdverseMove: outcome === "invalidated" ? -1 : 0,
      maxFavorableR: targetR,
      maxAdverseR: outcome === "invalidated" ? -1 : 0,
      resultR: input.resultR,
      reachedAt: outcome === "worked" ? Date.parse("2025-05-01T01:00:00.000Z") : null,
      invalidatedAt: outcome === "invalidated" ? Date.parse("2025-05-01T01:00:00.000Z") : null,
    },
  };
}
