import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { buildReaderHypothesisMonteCarloReport } from "./build-reader-hypothesis-monte-carlo-report";
import type { ReaderHypothesis } from "./types";

describe("buildReaderHypothesisMonteCarloReport", () => {
  test("runs deterministic trade-order and day-block simulations", () => {
    const trend = hypothesisFor("trend", { family: "trend-continuation" });
    const candidates = [
      candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 4 }),
      candidate({ index: 2, observedAt: "2025-05-02T00:00:00.000Z", resultR: -1 }),
      candidate({ index: 3, observedAt: "2025-05-03T00:00:00.000Z", resultR: 2 }),
    ];

    const first = buildReaderHypothesisMonteCarloReport({
      candidates,
      hypotheses: [trend],
      options: { samples: 50, seed: 99, ruinDrawdownR: -4 },
    });
    const second = buildReaderHypothesisMonteCarloReport({
      candidates,
      hypotheses: [trend],
      options: { samples: 50, seed: 99, ruinDrawdownR: -4 },
    });

    expect(first.ranked[0]?.tradeOrder).toEqual(second.ranked[0]?.tradeOrder);
    expect(first.ranked[0]?.dayBlock).toEqual(second.ranked[0]?.dayBlock);
  });

  test("reports higher ruin risk for a choppier path", () => {
    const choppy = hypothesisFor("choppy", { family: "absorption-reaction" });
    const smooth = hypothesisFor("smooth", { family: "trend-continuation" });

    const report = buildReaderHypothesisMonteCarloReport({
      candidates: [
        candidate({ index: 1, family: "absorption-reaction", observedAt: "2025-05-01T00:00:00.000Z", resultR: -4 }),
        candidate({ index: 2, family: "absorption-reaction", observedAt: "2025-05-02T00:00:00.000Z", resultR: 7 }),
        candidate({ index: 3, family: "trend-continuation", observedAt: "2025-05-01T00:00:00.000Z", resultR: 1 }),
        candidate({ index: 4, family: "trend-continuation", observedAt: "2025-05-02T00:00:00.000Z", resultR: 2 }),
      ],
      hypotheses: [choppy, smooth],
      options: { samples: 100, seed: 7, ruinDrawdownR: -3 },
    });

    const choppyResult = report.ranked.find((result) => result.hypothesis.id === "choppy");
    const smoothResult = report.ranked.find((result) => result.hypothesis.id === "smooth");
    expect(choppyResult?.tradeOrder.ruinProbability).toBeGreaterThan(smoothResult?.tradeOrder.ruinProbability ?? 1);
  });
});

function hypothesisFor(id: string, filters: ReaderHypothesis["filters"]): ReaderHypothesis {
  return {
    id,
    label: id,
    description: "test",
    kind: filters.family === "trend-continuation" ? "trend-following" : "adverse-reader",
    filters,
    confirmation: { type: "none", thresholdR: 0 },
  };
}

function candidate(input: {
  index: number;
  observedAt: string;
  resultR: number;
  family?: ReaderCandidate["family"];
}): ReaderCandidate {
  const outcome = input.resultR > 0 ? "worked" : "invalidated";
  const targetR = input.resultR > 0 ? input.resultR : 3;
  return {
    index: input.index,
    asset: "BTCUSDT",
    observedAt: Date.parse(input.observedAt),
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
      invalidationBps: 4,
      targetR,
      maxFavorableMove: targetR,
      maxAdverseMove: outcome === "invalidated" ? -1 : 0,
      maxFavorableR: targetR,
      maxAdverseR: outcome === "invalidated" ? -1 : 0,
      resultR: input.resultR,
      reachedAt: outcome === "worked" ? Date.parse(input.observedAt) + 60_000 : null,
      invalidatedAt: outcome === "invalidated" ? Date.parse(input.observedAt) + 60_000 : null,
    },
  };
}
