import { describe, expect, test } from "bun:test";
import { profileReaderCandidateGroups } from "./profile-reader-candidate-groups";
import type { ReaderCandidate } from "../reader-candidates/types";

describe("profileReaderCandidateGroups", () => {
  test("groups filtered candidates by categorical reader states with worst groups first", () => {
    const profile = profileReaderCandidateGroups({
      candidates: [
        candidate({ index: 1, side: "long", firstReaction: "favorable", r: 5 }),
        candidate({ index: 2, side: "long", firstReaction: "adverse", localRangeLocation: "middle", r: -1 }),
        candidate({ index: 3, side: "long", firstReaction: "adverse", localRangeLocation: "middle", r: -1 }),
        candidate({ index: 4, side: "short", firstReaction: "favorable", r: 3 }),
      ],
      filter: {
        side: "long",
        riskTargetOnly: true,
      },
      minimumGroupSize: 2,
    });

    expect(profile.groups.find((group) => group.key === "first-reaction|adverse")?.summary.totalR).toBe(-2);
    expect(profile.groups.some((group) => group.key === "side|short")).toBe(false);
    expect(profile.groups.find((group) => group.key === "local-range|middle")?.summary.totalR).toBe(-2);
    expect(profile.groups.find((group) => group.key === "target-r|target>=6R")?.summary.totalR).toBe(3);
    expect(profile.groups.find((group) => group.key === "first-target-r|adverse|target>=6R")?.summary.totalR).toBe(-2);
    expect(profile.groups.find((group) => group.key === "builder-local-first|no-trade|middle|adverse")?.summary.totalR).toBe(-2);
  });
});

function candidate(input: {
  index: number;
  side: "long" | "short";
  firstReaction: "favorable" | "adverse";
  localRangeLocation?: "lower-edge" | "middle" | "upper-edge";
  r: number;
}): ReaderCandidate {
  return {
    index: input.index,
    asset: "BTCUSDT",
    observedAt: Date.parse(`2025-09-0${input.index}T00:00:00.000Z`),
    family: "trend-continuation",
    side: input.side,
    entryPrice: 100,
    target: 110,
    invalidation: 99,
    reader: {
      auctionLocation: input.side === "long" ? "value-low" : "value-high",
      auctionLevelKind: input.side === "long" ? "support" : "resistance",
      auctionMode: "failed-expansion",
      auctionPhase: "failed-expansion-fade",
      vpAuction: "inside-value",
      vpPoc: input.side === "long" ? "poc-migrating-up" : "poc-migrating-down",
      vpValue: "value-stable",
      regime: "range",
      narrativeIntent: "continuation-pullback",
      narrativeDirection: input.side,
      localRangeLocation: input.localRangeLocation ?? (input.side === "long" ? "lower-edge" : "upper-edge"),
      localRangePosition: input.localRangeLocation === "middle" ? 0.5 : input.side === "long" ? 0.1 : 0.9,
    },
    orderflow: {
      pressure: input.side === "long" ? "buy-pressure" : "sell-pressure",
      events: ["large-print"],
      tradeCount: 20,
      largestTradeSide: input.side === "long" ? "buy" : "sell",
    },
    builder: {
      response: "no-trade",
      setupFamily: "trend-continuation",
      reasons: [],
    },
    outcome: {
      verdict: input.r > 0 ? "worked" : "invalidated",
      firstReaction: input.firstReaction,
      firstReactionMove: input.firstReaction === "favorable" ? 1 : -1,
      firstReactionR: input.firstReaction === "favorable" ? 0.1 : -0.1,
      targetDistance: 10,
      invalidationDistance: 1,
      targetBps: 100,
      invalidationBps: 10,
      targetR: 10,
      maxFavorableMove: input.r > 0 ? input.r : 0,
      maxAdverseMove: input.r < 0 ? input.r : 0,
      maxFavorableR: input.r > 0 ? input.r : 0,
      maxAdverseR: input.r < 0 ? input.r : 0,
      resultR: input.r,
      reachedAt: input.r > 0 ? Date.now() : null,
      invalidatedAt: input.r < 0 ? Date.now() : null,
    },
  };
}


