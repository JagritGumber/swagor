import { describe, expect, test } from "bun:test";
import { analyzeReaderTrades } from "./analyze-reader-trades";
import type { ReaderTradeDossier } from "../reader-evidence/types";

describe("analyzeReaderTrades", () => {
  test("measures first reaction and excursion from post-entry priced reads", () => {
    const report = analyzeReaderTrades({
      trades: [
        trade({
          side: "long",
          entryPrice: 100,
          stop: 98,
          target: 104,
          exitPrice: 104,
          r: 2,
          afterPrices: [101, 99, 103],
        }),
      ],
    });

    expect(report.summary.totalR).toBe(2);
    expect(report.trades[0]?.metrics.firstReaction).toBe("favorable-first-read");
    expect(report.trades[0]?.metrics.firstReactionR).toBe(0.5);
    expect(report.trades[0]?.metrics.observedMfeR).toBe(1.5);
    expect(report.trades[0]?.metrics.observedMaeR).toBe(-0.5);
  });

  test("keeps untrusted trades out of grouped result summaries", () => {
    const report = analyzeReaderTrades({
      minCoveragePct: 90,
      trades: [
        trade({ r: 1, coveragePctWhileOpen: 100 }),
        trade({ r: -1, coveragePctWhileOpen: 50 }),
      ],
    });

    expect(report.summary.registeredTrades).toBe(2);
    expect(report.summary.judgeableTrades).toBe(1);
    expect(report.summary.totalR).toBe(1);
    expect(report.groups.byDay[0]?.summary.judgeableTrades).toBe(1);
  });

  test("reports dated equity state without treating peak drawdown as starting loss", () => {
    const report = analyzeReaderTrades({
      riskPct: 0.25,
      initialCapital: 10_000,
      trades: [
        trade({ r: 10, entryAtOffsetMs: 0 }),
        trade({ r: -4, entryAtOffsetMs: 86_400_000 }),
        trade({ r: -3, entryAtOffsetMs: 172_800_000 }),
      ],
    });

    expect(report.summary.totalR).toBe(3);
    expect(report.summary.maxDrawdownR).toBe(-7);
    expect(report.summary.maxDrawdownFrom).toBe("2025-05-01");
    expect(report.summary.maxDrawdownAt).toBe("2025-05-03");
    expect(report.summary.minEquityR).toBe(0);
    expect(report.summary.minEquityAt).toBe("start");
    expect(report.summary.returnPct).toBe(0.75);
    expect(report.summary.capitalRequiredAtRiskPct).toBe(10_000);
  });

  test("marks adverse no-rotation losses as invalidated narrative", () => {
    const report = analyzeReaderTrades({
      trades: [
        trade({
          side: "long",
          entryPrice: 100,
          stop: 98,
          target: 104,
          exitPrice: 98,
          r: -1,
          afterPrices: [99],
        }),
      ],
    });

    expect(report.trades[0]?.narrativeAudit.verdict).toBe("invalidated");
    expect(report.groups.byNarrativeVerdict[0]?.key).toBe("invalidated");
    expect(report.trades[0]?.narrativeAudit.invalidatingEvidence).toContain("first post-entry read moved against the thesis");
  });

  test("marks repeated thesis failure as wrong narrative", () => {
    const report = analyzeReaderTrades({
      trades: [
        trade({ r: -1, afterPrices: [99], entryAtOffsetMs: 0 }),
        trade({ r: -1, afterPrices: [99], entryAtOffsetMs: 300_000 }),
        trade({ r: -1, afterPrices: [99], entryAtOffsetMs: 600_000 }),
      ],
    });

    expect(report.trades[0]?.narrativeAudit.verdict).toBe("invalidated");
    expect(report.trades[1]?.narrativeAudit.verdict).toBe("invalidated");
    expect(report.trades[2]?.narrativeAudit.verdict).toBe("wrong");
    expect(report.narrativeFailureChains[0]?.losses).toBe(3);
  });
});

function trade(input: Partial<{
  side: "long" | "short";
  entryPrice: number;
  stop: number;
  target: number;
  exitPrice: number;
  r: number;
  afterPrices: number[];
  coveragePctWhileOpen: number;
  entryAtOffsetMs: number;
}>): ReaderTradeDossier {
  const side = input.side ?? "long";
  const entryPrice = input.entryPrice ?? 100;
  const stop = input.stop ?? 98;
  const target = input.target ?? 104;
  const r = input.r ?? 1;
  const entryAt = Date.parse("2025-05-01T00:00:00.000Z") + (input.entryAtOffsetMs ?? 0);
  return {
    trade: {
      asset: "BTCUSDT",
      setupKey: "BTCUSDT|5m",
      side,
      entryPrice,
      entryAt,
      stop,
      target,
      confidence: 0.7,
      reasons: ["test"],
      exitPrice: input.exitPrice ?? target,
      exitAt: entryAt + 300_000,
      exitReason: r > 0 ? "target" : "stop",
      r,
      setupFamily: "reversal-reclaim",
      regime: {
        mode: "range",
        highVol: false,
        rangePct: 1,
        driftPct: 0,
        directionalEfficiency: 0.2,
        reason: "test",
      },
    },
    setup: {
      key: "BTCUSDT|5m",
      planSource: "fresh-read",
      setupAgeMs: 60_000,
      readCount: 2,
      confidence: 0.7,
      reasons: ["test"],
      events: [],
    },
    auction: {
      asset: "BTCUSDT",
      interval: "5m",
      level: {
        kind: "support",
        price: 99,
        touches: 2,
        firstTouchedAt: Date.parse("2025-05-01T00:00:00.000Z"),
        lastTouchedAt: Date.parse("2025-05-01T00:00:00.000Z"),
      },
      profile: {
        low: 95,
        high: 105,
        binSize: 1,
        poc: 101,
        valueAreaLow: 98,
        valueAreaHigh: 103,
        binCount: 10,
      },
      location: "near-poc",
      bias: "wait",
      narrative: "test",
      invalidation: null,
      target: null,
    },
    orderflow: {
      asset: "BTCUSDT",
      windowSeconds: 300,
      lastPrice: entryPrice,
      buyVolume: 10,
      sellVolume: 20,
      averageTradeSize: 1,
      dominantSide: "sell",
      pressure: "sell-pressure",
      delta: -10,
      tradeCount: 20,
      largestTrade: null,
      events: ["confirmed-absorption"],
      narrative: "test",
    },
    candles: {
      beforeEntry: [],
      entryClosedCandle: null,
      exitClosedCandle: null,
      afterExit: [],
      stats: {
        high: 104,
        low: 96,
        volume: 100,
        range: 8,
        entryClosePosition: 0.5,
        postExitHigh: null,
        postExitLow: null,
      },
    },
    execution: {
      missingPriceReads: 0,
      heldReads: 1,
      pricedReadsWhileOpen: 1,
      unpricedReadsWhileOpen: 0,
      coveragePctWhileOpen: input.coveragePctWhileOpen ?? 100,
      longestUnpricedRunWhileOpen: 0,
      longestUnpricedGapMsWhileOpen: null,
      quality: (input.coveragePctWhileOpen ?? 100) < 80 ? "unusable" : "clean",
      diagnosis: (input.coveragePctWhileOpen ?? 100) < 80 ? "sparse-price-coverage" : "clean-price-coverage",
    },
    formation: {
      beforeEntry: [],
      significantBeforeEntry: [],
      afterEntry: (input.afterPrices ?? []).map((price, index) => ({
        asset: "BTCUSDT",
        setupKey: "BTCUSDT|5m",
        at: entryAt + 60_000 + index * 60_000,
        lastPrice: price,
        stance: "wait",
        auction: {
          location: "near-poc",
          bias: "wait",
          levelKind: "support",
          levelPrice: 99,
          poc: 101,
          valueAreaLow: 98,
          valueAreaHigh: 103,
        },
        orderflow: {
          pressure: "sell-pressure",
          delta: -10,
          tradeCount: 20,
          largestTrade: null,
          events: ["confirmed-absorption"],
        },
        setup: {
          planSource: "fresh-read",
          planStatus: "ready",
          setupFamily: "reversal-reclaim",
          eventTypes: [],
        },
        resultEventTypes: [],
      })),
    },
    verdict: "valid-setup-good-outcome",
  };
}


