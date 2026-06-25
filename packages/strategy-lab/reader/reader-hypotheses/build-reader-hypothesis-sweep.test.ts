import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { buildReaderHypothesisSweep } from "./build-reader-hypothesis-sweep";

describe("buildReaderHypothesisSweep", () => {
  test("generates and ranks configured hypothesis variants", () => {
    const report = buildReaderHypothesisSweep({
      candidates: [
        candidate({ index: 1, family: "trend-continuation", resultR: 4, maxFavorableR: 4 }),
        candidate({ index: 2, family: "trend-continuation", resultR: -1, maxFavorableR: 0.3 }),
        candidate({ index: 3, family: "absorption-reaction", resultR: 2, maxFavorableR: 2 }),
      ],
      sweep: {
        families: ["trend-continuation", "absorption-reaction"],
        sides: ["long"],
        regimes: ["range"],
        events: ["*"],
        confirmationTypes: ["none", "max-favorable"],
        thresholdsR: [0, 0.25],
        invalidationBpsBands: [{ min: 2, max: 5 }],
        tradeCountBands: [{ min: 0, max: 250 }],
        minEntries: 1,
        top: 10,
      },
    });

    expect(report.summary.generated).toBe(6);
    expect(report.summary.kept).toBe(6);
    expect(report.ranked[0]?.summary.totalR).toBeGreaterThan(0);
    expect(report.bestByKind.some((result) => result.hypothesis.kind === "trend-following")).toBe(true);
    expect(report.bestByKind.some((result) => result.hypothesis.kind === "adverse-reader")).toBe(true);
  });

  test("filters by entry bounds and subtracts configured costs", () => {
    const report = buildReaderHypothesisSweep({
      candidates: [
        candidate({ index: 1, resultR: 2, invalidationBps: 4 }),
        candidate({ index: 2, resultR: -1, invalidationBps: 4 }),
      ],
      sweep: {
        families: ["trend-continuation"],
        sides: ["long"],
        regimes: ["range"],
        events: ["*"],
        confirmationTypes: ["none"],
        thresholdsR: [0],
        invalidationBpsBands: [{ min: 2, max: 5 }],
        tradeCountBands: [{ min: 0, max: 250 }],
        minEntries: 2,
        maxEntries: 2,
      },
      options: {
        roundTripCostBps: 1,
      },
    });

    expect(report.summary.kept).toBe(1);
    expect(report.ranked[0]?.summary.totalR).toBe(0.5);
    expect(report.ranked[0]?.summary.entries).toBe(2);
  });
});

function candidate(input: {
  index: number;
  family?: ReaderCandidate["family"];
  resultR: number;
  maxFavorableR?: number;
  invalidationBps?: number;
}): ReaderCandidate {
  const outcome = input.resultR > 0 ? "worked" : "invalidated";
  const targetR = input.resultR > 0 ? input.resultR : 3;
  return {
    index: input.index,
    asset: "BTCUSDT",
    observedAt: Date.parse(`2025-05-01T00:${String(input.index).padStart(2, "0")}:00.000Z`),
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



