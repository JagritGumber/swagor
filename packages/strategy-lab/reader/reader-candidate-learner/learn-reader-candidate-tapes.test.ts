import { describe, expect, test } from "bun:test";
import type { ReaderCandidate } from "../reader-candidates/types";
import { learnReaderCandidateTapes } from "./learn-reader-candidate-tapes";

describe("learnReaderCandidateTapes", () => {
  test("does not promote worked candidates whose target is below the risk unit", () => {
    const report = learnReaderCandidateTapes({
      minimumSampleForGuidance: 2,
      tapes: [tape([
        candidate({ outcome: "worked", targetR: 0.5, resultR: 0.5 }),
        candidate({ outcome: "worked", targetR: 0.7, resultR: 0.7 }),
        candidate({ outcome: "invalidated", targetR: 0.6, resultR: -1 }),
      ])],
    });

    expect(report.builderTooStrictCandidates).toHaveLength(0);
    expect(report.riskRewardArtifactCandidates).toHaveLength(1);
    expect(report.riskRewardArtifactCandidates[0]?.summary.subRiskTarget).toBe(3);
  });

  test("promotes ignored candidates only when sample, result, and risk reward are usable", () => {
    const report = learnReaderCandidateTapes({
      minimumSampleForGuidance: 2,
      tapes: [tape([
        candidate({ outcome: "worked", targetR: 1.5, resultR: 1.5 }),
        candidate({ outcome: "worked", targetR: 1.2, resultR: 1.2 }),
        candidate({ outcome: "invalidated", targetR: 1.4, resultR: -1 }),
      ])],
    });

    expect(report.riskRewardArtifactCandidates).toHaveLength(0);
    expect(report.builderTooStrictCandidates).toHaveLength(1);
    expect(report.builderTooStrictCandidates[0]?.summary.worked).toBe(2);
    expect(report.builderTooStrictCandidates[0]?.summary.medianFirstReactionR).toBe(0.25);
  });

  test("splits sub-risk candidates from usable risk-target candidates", () => {
    const report = learnReaderCandidateTapes({
      minimumSampleForGuidance: 2,
      tapes: [tape([
        candidate({ outcome: "worked", targetR: 0.5, resultR: 0.5 }),
        candidate({ outcome: "worked", targetR: 0.7, resultR: 0.7 }),
        candidate({ outcome: "worked", targetR: 1.5, resultR: 1.5 }),
        candidate({ outcome: "worked", targetR: 1.2, resultR: 1.2 }),
        candidate({ outcome: "invalidated", targetR: 1.4, resultR: -1 }),
      ])],
    });

    expect(report.riskRewardArtifactCandidates).toHaveLength(1);
    expect(report.riskRewardArtifactCandidates[0]?.summary.candidates).toBe(2);
    expect(report.builderTooStrictCandidates).toHaveLength(1);
    expect(report.builderTooStrictCandidates[0]?.summary.candidates).toBe(3);
  });

  test("splits candidates by first live reaction", () => {
    const report = learnReaderCandidateTapes({
      minimumSampleForGuidance: 2,
      tapes: [tape([
        candidate({ outcome: "worked", targetR: 1.5, resultR: 1.5, firstReaction: "favorable" }),
        candidate({ outcome: "worked", targetR: 1.2, resultR: 1.2, firstReaction: "favorable" }),
        candidate({ outcome: "invalidated", targetR: 1.4, resultR: -1, firstReaction: "adverse" }),
        candidate({ outcome: "invalidated", targetR: 1.3, resultR: -1, firstReaction: "adverse" }),
      ])],
    });

    expect(report.builderTooStrictCandidates).toHaveLength(1);
    expect(report.builderTooStrictCandidates[0]?.summary.candidates).toBe(2);
    expect(report.futureAvoidCandidates).toHaveLength(1);
    expect(report.futureAvoidCandidates[0]?.summary.candidates).toBe(2);
  });
});

function tape(candidates: ReaderCandidate[]) {
  return {
    summary: {
      candidates: candidates.length,
      directional: candidates.length,
      nonDirectional: 0,
      worked: candidates.filter((item) => item.outcome.verdict === "worked").length,
      invalidated: candidates.filter((item) => item.outcome.verdict === "invalidated").length,
      unresolved: 0,
      unjudgeable: 0,
      executed: 0,
    },
    assets: [{
      asset: "BTCUSDT",
      tape: {
        summary: {
          candidates: candidates.length,
          directional: candidates.length,
          nonDirectional: 0,
          worked: candidates.filter((item) => item.outcome.verdict === "worked").length,
          invalidated: candidates.filter((item) => item.outcome.verdict === "invalidated").length,
          unresolved: 0,
          unjudgeable: 0,
          executed: 0,
        },
        candidates,
      },
    }],
  };
}

function candidate(input: {
  outcome: "worked" | "invalidated";
  targetR: number;
  resultR: number;
  firstReaction?: "favorable" | "adverse";
}): ReaderCandidate {
  return {
    index: 1,
    asset: "BTCUSDT",
    observedAt: Date.parse("2025-05-01T00:00:00.000Z"),
    family: "absorption-reaction",
    side: "long",
    entryPrice: 100,
    target: 101,
    invalidation: 99,
    reader: {
      auctionLocation: "value-high",
      auctionLevelKind: "support",
      auctionMode: "failed-expansion",
      auctionPhase: "failed-expansion-fade",
      vpAuction: "inside-value",
      vpPoc: "poc-stable",
      vpValue: "value-stable",
      regime: "range",
      narrativeIntent: "reversal-reclaim",
      narrativeDirection: "long",
      localRangeLocation: "lower-edge",
      localRangePosition: 0.1,
    },
    orderflow: {
      pressure: "sell-pressure",
      events: ["confirmed-absorption", "stalled-selling"],
      tradeCount: 100,
      largestTradeSide: "sell",
    },
    builder: {
      response: "no-trade",
      setupFamily: null,
      reasons: ["builder did not execute"],
    },
    outcome: {
      verdict: input.outcome,
      firstReaction: input.firstReaction ?? "favorable",
      firstReactionMove: input.firstReaction === "adverse" ? -0.25 : 0.25,
      firstReactionR: input.firstReaction === "adverse" ? -0.25 : 0.25,
      targetDistance: 1,
      invalidationDistance: 1,
      targetBps: 100,
      invalidationBps: 100,
      targetR: input.targetR,
      maxFavorableMove: 1,
      maxAdverseMove: input.outcome === "invalidated" ? -1 : 0,
      maxFavorableR: input.targetR,
      maxAdverseR: input.outcome === "invalidated" ? -1 : 0,
      resultR: input.resultR,
      reachedAt: input.outcome === "worked" ? Date.parse("2025-05-01T00:05:00.000Z") : null,
      invalidatedAt: input.outcome === "invalidated" ? Date.parse("2025-05-01T00:05:00.000Z") : null,
    },
  };
}



