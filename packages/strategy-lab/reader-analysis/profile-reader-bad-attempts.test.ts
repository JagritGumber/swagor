import { describe, expect, test } from "bun:test";
import { profileReaderBadAttempts, type ReaderBadAttemptTrade } from "./profile-reader-bad-attempts";

describe("profileReaderBadAttempts", () => {
  test("reports gross R and losses-first fragility separately from chronological drawdown", () => {
    const report = profileReaderBadAttempts({
      trades: [
        trade(10, "2025-05-01"),
        trade(-1, "2025-05-02"),
        trade(-1, "2025-05-03"),
        trade(-1, "2025-05-04"),
      ],
      minimumGroupSize: 1,
    });

    expect(report.summary.totalR).toBe(7);
    expect(report.summary.grossWinR).toBe(10);
    expect(report.summary.grossLossR).toBe(-3);
    expect(report.summary.profitFactor).toBe(3.3333);
    expect(report.summary.maxDrawdownR).toBe(-3);
    expect(report.summary.minEquityR).toBe(0);
    expect(report.summary.lossesFirstMaxDrawdownR).toBe(-3);
    expect(report.summary.lossesFirstMinEquityR).toBe(-3);
  });

  test("nets explicit trade costs before win rate and drawdown are summarized", () => {
    const report = profileReaderBadAttempts({
      trades: [
        trade(0.1, "2025-05-01"),
        trade(0.3, "2025-05-02"),
      ],
      minimumGroupSize: 1,
      costRPerTrade: 0.2,
    });

    expect(report.summary.rawTotalR).toBe(0.4);
    expect(report.summary.totalR).toBe(0);
    expect(report.summary.wins).toBe(1);
    expect(report.summary.losses).toBe(1);
    expect(report.summary.grossWinR).toBe(0.1);
    expect(report.summary.grossLossR).toBe(-0.1);
    expect(report.summary.maxDrawdownR).toBe(-0.1);
    expect(report.summary.lossesFirstMaxDrawdownR).toBe(-0.1);
  });
});

function trade(r: number, day: string): ReaderBadAttemptTrade {
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
      labels: [],
    },
  };
}
