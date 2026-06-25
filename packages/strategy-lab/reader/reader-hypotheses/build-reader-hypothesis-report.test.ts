import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { buildReaderHypothesisReport } from "./build-reader-hypothesis-report";
import type { ReaderHypothesis } from "./types";

describe("buildReaderHypothesisReport", () => {
  test("ranks hypotheses and reports best result by kind", () => {
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

    const report = buildReaderHypothesisReport({
      candidates: [
        candidate({ index: 1, family: "trend-continuation", resultR: 2 }),
        candidate({ index: 2, family: "absorption-reaction", resultR: 4 }),
      ],
      hypotheses: [trend, adverse],
    });

    expect(report.summary.candidates).toBe(2);
    expect(report.ranked.map((result) => result.hypothesis.id)).toEqual(["adverse", "trend"]);
    expect(report.bestByKind.map((result) => result.hypothesis.id)).toEqual(["adverse", "trend"]);
  });

  test("splits each hypothesis result by month, family, and regime", () => {
    const trend: ReaderHypothesis = {
      id: "trend",
      label: "trend",
      description: "test",
      kind: "trend-following",
      filters: { family: "trend-continuation" },
      confirmation: { type: "none", thresholdR: 0 },
    };

    const report = buildReaderHypothesisReport({
      candidates: [
        candidate({ index: 1, observedAt: Date.parse("2025-06-01T00:00:00.000Z"), resultR: 3, regime: "trend-up" }),
        candidate({ index: 2, observedAt: Date.parse("2025-07-01T00:00:00.000Z"), resultR: -1, regime: "range" }),
        candidate({ index: 3, family: "absorption-reaction", resultR: 10, regime: "range" }),
      ],
      hypotheses: [trend],
    });

    const result = report.ranked[0];
    expect(result?.summary.totalR).toBe(2);
    expect(result?.byMonth.map((group) => [group.key, group.summary.totalR])).toEqual([
      ["2025-06", 3],
      ["2025-07", -1],
    ]);
    expect(result?.byFamily.map((group) => [group.key, group.summary.entries])).toEqual([
      ["trend-continuation", 2],
    ]);
    expect(result?.byRegime.map((group) => [group.key, group.summary.totalR])).toEqual([
      ["trend-up", 3],
      ["range", -1],
    ]);
  });

  test("propagates cost options into report summaries and groups", () => {
    const trend: ReaderHypothesis = {
      id: "trend",
      label: "trend",
      description: "test",
      kind: "trend-following",
      filters: { family: "trend-continuation" },
      confirmation: { type: "none", thresholdR: 0 },
    };

    const report = buildReaderHypothesisReport({
      candidates: [
        candidate({ index: 1, resultR: 2, invalidationBps: 4 }),
        candidate({ index: 2, resultR: -1, invalidationBps: 4 }),
      ],
      hypotheses: [trend],
      options: { roundTripCostBps: 1 },
    });

    expect(report.summary.roundTripCostBps).toBe(1);
    expect(report.ranked[0]?.summary.totalR).toBe(0.5);
    expect(report.ranked[0]?.byFamily[0]?.summary.totalR).toBe(0.5);
  });
});

function candidate(input: {
  index: number;
  outcome?: "worked" | "invalidated";
  family?: ReaderCandidate["family"];
  resultR: number;
  observedAt?: number;
  targetR?: number;
  invalidationBps?: number;
  regime?: string | null;
}): ReaderCandidate {
  const outcome = input.outcome ?? (input.resultR > 0 ? "worked" : "invalidated");
  const targetR = input.targetR ?? (input.resultR > 0 ? input.resultR : 3);
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
      regime: input.regime ?? "range",
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


