import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { buildReaderHypothesisScoreReport } from "./build-reader-hypothesis-score-report";
import type { ReaderHypothesis } from "./types";

describe("buildReaderHypothesisScoreReport", () => {
  test("counts no-trade days against per-day productivity", () => {
    const hypothesis = hypothesisFor("trend", { family: "trend-continuation" });
    const report = buildReaderHypothesisScoreReport({
      candidates: [
        candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 3 }),
        candidate({ index: 2, observedAt: "2025-05-03T00:00:00.000Z", resultR: -1 }),
      ],
      hypotheses: [hypothesis],
      options: { bootstrapSamples: 20, bootstrapSeed: 7 },
    });

    const result = report.ranked[0];
    expect(report.summary.evaluatedDays).toBe(3);
    expect(result?.path.entryDays).toBe(2);
    expect(result?.path.totalR).toBe(2);
    expect(result?.path.rPerEvaluatedDay).toBe(0.6667);
    expect(result?.path.rPerTrade).toBe(1);
  });

  test("keeps a tiny high-return sample behind a broader robust sample when rank evidence is weaker", () => {
    const rare = hypothesisFor("rare", { family: "absorption-reaction" });
    const broad = hypothesisFor("broad", { family: "trend-continuation" });
    const report = buildReaderHypothesisScoreReport({
      candidates: [
        candidate({ index: 1, family: "absorption-reaction", observedAt: "2025-05-01T00:00:00.000Z", resultR: 20 }),
        candidate({ index: 2, family: "trend-continuation", observedAt: "2025-05-01T00:00:00.000Z", resultR: 2 }),
        candidate({ index: 3, family: "trend-continuation", observedAt: "2025-05-02T00:00:00.000Z", resultR: 2 }),
        candidate({ index: 4, family: "trend-continuation", observedAt: "2025-05-03T00:00:00.000Z", resultR: 2 }),
        candidate({ index: 5, family: "trend-continuation", observedAt: "2025-05-04T00:00:00.000Z", resultR: 2 }),
      ],
      hypotheses: [rare, broad],
      options: { bootstrapSamples: 40, bootstrapSeed: 11 },
    });

    const rareResult = report.ranked.find((result) => result.hypothesis.id === "rare");
    const broadResult = report.ranked.find((result) => result.hypothesis.id === "broad");
    expect(rareResult?.path.totalR).toBeGreaterThan(broadResult?.path.totalR ?? 0);
    expect(broadResult?.metricRanks.activity).toBeLessThan(rareResult?.metricRanks.activity ?? 99);
    expect(broadResult?.metricRanks.winConfidence).toBeLessThan(rareResult?.metricRanks.winConfidence ?? 99);
  });

  test("reports worse risk for equal return with deeper drawdown", () => {
    const choppy = hypothesisFor("choppy", { family: "absorption-reaction" });
    const smooth = hypothesisFor("smooth", { family: "trend-continuation" });
    const report = buildReaderHypothesisScoreReport({
      candidates: [
        candidate({ index: 1, family: "absorption-reaction", observedAt: "2025-05-01T00:00:00.000Z", resultR: -4 }),
        candidate({ index: 2, family: "absorption-reaction", observedAt: "2025-05-02T00:00:00.000Z", resultR: 7 }),
        candidate({ index: 3, family: "trend-continuation", observedAt: "2025-05-01T00:00:00.000Z", resultR: 1 }),
        candidate({ index: 4, family: "trend-continuation", observedAt: "2025-05-02T00:00:00.000Z", resultR: 2 }),
      ],
      hypotheses: [choppy, smooth],
      options: { bootstrapSamples: 20, bootstrapSeed: 3 },
    });

    const choppyResult = report.ranked.find((result) => result.hypothesis.id === "choppy");
    const smoothResult = report.ranked.find((result) => result.hypothesis.id === "smooth");
    expect(choppyResult?.path.totalR).toBe(smoothResult?.path.totalR);
    expect(choppyResult?.path.maxDrawdownR).toBeLessThan(smoothResult?.path.maxDrawdownR ?? 0);
    expect(smoothResult?.metricRanks.risk).toBeLessThan(choppyResult?.metricRanks.risk ?? 99);
  });

  test("bootstraps deterministically with a fixed seed", () => {
    const trend = hypothesisFor("trend", { family: "trend-continuation" });
    const candidates = [
      candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 3 }),
      candidate({ index: 2, observedAt: "2025-05-02T00:00:00.000Z", resultR: -1 }),
      candidate({ index: 3, observedAt: "2025-05-03T00:00:00.000Z", resultR: 2 }),
    ];

    const first = buildReaderHypothesisScoreReport({
      candidates,
      hypotheses: [trend],
      options: { bootstrapSamples: 50, bootstrapSeed: 99 },
    }).ranked[0]?.bootstrap;
    const second = buildReaderHypothesisScoreReport({
      candidates,
      hypotheses: [trend],
      options: { bootstrapSamples: 50, bootstrapSeed: 99 },
    }).ranked[0]?.bootstrap;

    expect(first).toEqual(second);
  });

  test("counts inactive calendar months as flat stability months", () => {
    const trend = hypothesisFor("trend", { family: "trend-continuation" });
    const report = buildReaderHypothesisScoreReport({
      candidates: [
        candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 3 }),
        candidate({ index: 2, family: "absorption-reaction", observedAt: "2025-07-01T00:00:00.000Z", resultR: 2 }),
      ],
      hypotheses: [trend],
      options: { bootstrapSamples: 20, bootstrapSeed: 5 },
    });

    const result = report.ranked[0];
    expect(result?.path.evaluatedMonths).toBe(3);
    expect(result?.path.positiveMonths).toBe(1);
    expect(result?.path.flatMonths).toBe(2);
    expect(result?.path.profitableMonthRate).toBe(0.3333);
  });

  test("rejects invalid exported bootstrap options", () => {
    const trend = hypothesisFor("trend", { family: "trend-continuation" });
    const candidates = [candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 3 })];

    expect(() => buildReaderHypothesisScoreReport({
      candidates,
      hypotheses: [trend],
      options: { bootstrapSamples: Number.POSITIVE_INFINITY },
    })).toThrow("bootstrapSamples");
    expect(() => buildReaderHypothesisScoreReport({
      candidates,
      hypotheses: [trend],
      options: { bootstrapPercentile: Number.NaN },
    })).toThrow("bootstrapPercentile");
  });

  test("rejects duplicate hypothesis ids before ranking", () => {
    const first = hypothesisFor("same", { family: "trend-continuation" });
    const second = hypothesisFor("same", { family: "absorption-reaction" });

    expect(() => buildReaderHypothesisScoreReport({
      candidates: [candidate({ index: 1, observedAt: "2025-05-01T00:00:00.000Z", resultR: 3 })],
      hypotheses: [first, second],
    })).toThrow("Duplicate reader hypothesis id");
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
