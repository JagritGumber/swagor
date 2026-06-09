import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { profileReaderCandidateReactions } from "./profile-reader-candidate-reactions";

describe("profileReaderCandidateReactions", () => {
  test("splits matching candidates into first-reaction R buckets", () => {
    const profile = profileReaderCandidateReactions({
      buckets: 2,
      filter: {
        family: "trend-continuation",
        side: "long",
        auctionLocation: "value-low",
        auctionLevelKind: "support",
        riskTargetOnly: true,
      },
      candidates: [
        candidate({ firstReactionR: -0.2, resultR: -1 }),
        candidate({ firstReactionR: 0.1, resultR: -1 }),
        candidate({ firstReactionR: 0.4, resultR: 2 }),
        candidate({ firstReactionR: 0.9, resultR: 3 }),
        candidate({ firstReactionR: 0.9, resultR: 3, family: "value-low-reaction" }),
      ],
    });

    expect(profile.summary.candidates).toBe(4);
    expect(profile.reactionBuckets).toHaveLength(2);
    expect(profile.reactionBuckets[0]?.minFirstReactionR).toBe(-0.2);
    expect(profile.reactionBuckets[0]?.maxFirstReactionR).toBe(0.1);
    expect(profile.reactionBuckets[0]?.summary.totalR).toBe(-2);
    expect(profile.reactionBuckets[0]?.summary.maxDrawdownR).toBe(-2);
    expect(profile.reactionBuckets[0]?.summary.minEquityR).toBe(-2);
    expect(profile.reactionBuckets[1]?.minFirstReactionR).toBe(0.4);
    expect(profile.reactionBuckets[1]?.summary.totalR).toBe(5);
    expect(profile.reactionBuckets[1]?.summary.maxDrawdownR).toBe(0);
  });

  test("reports chronological drawdown for matching candidates", () => {
    const profile = profileReaderCandidateReactions({
      buckets: 1,
      candidates: [
        candidate({ firstReactionR: 0.1, resultR: 4, observedAt: "2025-05-01T00:00:00.000Z" }),
        candidate({ firstReactionR: 0.2, resultR: -1, observedAt: "2025-05-01T00:01:00.000Z" }),
        candidate({ firstReactionR: 0.3, resultR: -1, observedAt: "2025-05-01T00:02:00.000Z" }),
        candidate({ firstReactionR: 0.4, resultR: 2, observedAt: "2025-05-01T00:03:00.000Z" }),
      ],
    });

    expect(profile.summary.totalR).toBe(4);
    expect(profile.summary.maxDrawdownR).toBe(-2);
    expect(profile.summary.minEquityR).toBe(0);
  });

  test("filters by reader and orderflow dimensions", () => {
    const profile = profileReaderCandidateReactions({
      buckets: 2,
      filter: {
        auctionMode: "failed-expansion",
        auctionPhase: "failed-expansion-fade",
        vpAuction: "inside-value",
        vpPoc: "poc-migrating-up",
        vpValue: "value-stable",
        orderflowPressure: "buy-pressure",
        narrativeIntent: "continuation-pullback",
        narrativeDirection: "long",
        localRangeLocation: "lower-edge",
      },
      candidates: [
        candidate({ firstReactionR: 0.4, resultR: 2 }),
        candidate({ firstReactionR: 0.5, resultR: 3, orderflowPressure: "sell-pressure" }),
        candidate({ firstReactionR: 0.6, resultR: 4, vpPoc: "poc-stable" }),
        candidate({ firstReactionR: 0.7, resultR: 5, localRangeLocation: "middle" }),
      ],
    });

    expect(profile.summary.candidates).toBe(1);
    expect(profile.summary.totalR).toBe(2);
  });
});

function candidate(input: {
  firstReactionR: number;
  resultR: number;
  family?: ReaderCandidate["family"];
  orderflowPressure?: string;
  vpPoc?: string;
  localRangeLocation?: string;
  observedAt?: string;
}): ReaderCandidate {
  return {
    index: 1,
    asset: "BTCUSDT",
    observedAt: Date.parse(input.observedAt ?? "2025-05-01T00:00:00.000Z"),
    family: input.family ?? "trend-continuation",
    side: "long",
    entryPrice: 100,
    target: 102,
    invalidation: 99,
    reader: {
      auctionLocation: "value-low",
      auctionLevelKind: "support",
      auctionMode: "failed-expansion",
      auctionPhase: "failed-expansion-fade",
      vpAuction: "inside-value",
      vpPoc: input.vpPoc ?? "poc-migrating-up",
      vpValue: "value-stable",
      regime: "range",
      narrativeIntent: "continuation-pullback",
      narrativeDirection: "long",
      localRangeLocation: input.localRangeLocation ?? "lower-edge",
      localRangePosition: input.localRangeLocation === "middle" ? 0.5 : 0.1,
    },
    orderflow: {
      pressure: input.orderflowPressure ?? "buy-pressure",
      events: ["large-print"],
      tradeCount: 100,
      largestTradeSide: "buy",
    },
    builder: {
      response: "no-trade",
      setupFamily: null,
      reasons: [],
    },
    outcome: {
      verdict: input.resultR > 0 ? "worked" : "invalidated",
      firstReaction: input.firstReactionR > 0 ? "favorable" : "adverse",
      firstReactionMove: input.firstReactionR,
      firstReactionR: input.firstReactionR,
      targetDistance: 2,
      invalidationDistance: 1,
      targetBps: 200,
      invalidationBps: 100,
      targetR: 2,
      maxFavorableMove: Math.max(0, input.resultR),
      maxAdverseMove: Math.min(0, input.resultR),
      maxFavorableR: Math.max(0, input.resultR),
      maxAdverseR: Math.min(0, input.resultR),
      resultR: input.resultR,
      reachedAt: input.resultR > 0 ? Date.parse("2025-05-01T00:05:00.000Z") : null,
      invalidatedAt: input.resultR < 0 ? Date.parse("2025-05-01T00:05:00.000Z") : null,
    },
  };
}
