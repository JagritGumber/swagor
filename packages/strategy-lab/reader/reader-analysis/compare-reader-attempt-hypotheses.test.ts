import { describe, expect, test } from "bun:test";
import { compareReaderAttemptHypotheses, type ReaderAttemptHypothesis } from "./compare-reader-attempt-hypotheses";
import type { ReaderBadAttemptTrade } from "./profile-reader-bad-attempts";

describe("compareReaderAttemptHypotheses", () => {
  test("orders positive hypotheses by risk quality before highest total R", () => {
    const trades = [
      trade(10, "2025-05-01", ["high-total", "stable"]),
      trade(-1, "2025-05-02", ["high-total"]),
      trade(-1, "2025-05-03", ["high-total"]),
      trade(-1, "2025-05-04", ["high-total"]),
      trade(2, "2025-05-05", ["stable"]),
    ];
    const hypotheses: ReaderAttemptHypothesis[] = [
      {
        key: "high-total",
        description: "Higher total but weaker loss profile.",
        keep: (candidate) => candidate.diagnostics.labels.includes("high-total"),
      },
      {
        key: "stable",
        description: "Lower total but better profit factor and loss path.",
        keep: (candidate) => candidate.diagnostics.labels.includes("stable"),
      },
    ];

    const report = compareReaderAttemptHypotheses({ trades, hypotheses });

    expect(report.results.map((result) => result.key)).toEqual(["stable", "high-total"]);
    expect(report.results[0]?.kept.totalR).toBe(12);
    expect(report.results[1]?.kept.totalR).toBe(7);
  });

  test("ranks hypotheses using net R after explicit costs", () => {
    const trades = [
      trade(0.1, "2025-05-01", ["tiny"]),
      trade(0.5, "2025-05-02", ["room"]),
    ];
    const hypotheses: ReaderAttemptHypothesis[] = [
      {
        key: "tiny",
        description: "Raw winner that costs turn negative.",
        keep: (candidate) => candidate.diagnostics.labels.includes("tiny"),
      },
      {
        key: "room",
        description: "Larger winner that survives costs.",
        keep: (candidate) => candidate.diagnostics.labels.includes("room"),
      },
    ];

    const report = compareReaderAttemptHypotheses({ trades, hypotheses, costRPerTrade: 0.2 });

    expect(report.baseline.rawTotalR).toBe(0.6);
    expect(report.baseline.totalR).toBe(0.2);
    expect(report.results.map((result) => result.key)).toEqual(["room", "tiny"]);
    expect(report.results[0]?.kept.totalR).toBe(0.3);
    expect(report.results[1]?.kept.totalR).toBe(-0.1);
  });
});

function trade(r: number, day: string, labels: string[]): ReaderBadAttemptTrade {
  return {
    index: 0,
    asset: "BTCUSDT",
    entryAt: `${day}T00:00:00.000Z`,
    side: "long",
    setupFamily: "trend-continuation",
    trust: true,
    result: { r },
    readerState: {
      regime: "range",
      auctionLocation: "value-low",
      auctionLevelKind: "support",
      auctionMode: "failed-expansion",
      auctionPhase: "failed-expansion-fade",
    },
    absorptionQuality: null,
    narrative: {
      key: "long-continuation",
      intent: "continuation-pullback",
      verdict: "valid",
      invalidatingEvidence: [],
    },
    vp: {
      auction: "inside-value",
      poc: "poc-migrating-up",
      value: "value-stable",
    },
    orderflow: {
      pressure: "buy-pressure",
      events: [],
    },
    diagnostics: {
      firstReaction: "favorable-first-read",
      firstReactionR: 0.1,
      observedMfeR: r > 0 ? r : 0,
      observedMaeR: r < 0 ? r : 0,
      entryTiming: "known",
      pocRotation: "moved-toward-poc",
      labels,
    },
  };
}



