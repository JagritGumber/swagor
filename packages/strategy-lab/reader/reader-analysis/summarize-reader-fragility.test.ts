import { describe, expect, test } from "bun:test";
import { summarizeReaderFragility } from "./summarize-reader-fragility";

describe("summarizeReaderFragility", () => {
  test("separates chronological drawdown from losses-first path risk", () => {
    const summary = summarizeReaderFragility([
      trade(10, "2025-05-01"),
      trade(-1, "2025-05-02"),
      trade(-1, "2025-05-03"),
      trade(-1, "2025-05-04"),
    ], { riskPct: 0.25, monteCarloRuns: 20, seed: 1 });

    expect(summary.totalR).toBe(7);
    expect(summary.grossWinR).toBe(10);
    expect(summary.grossLossR).toBe(-3);
    expect(summary.profitFactor).toBe(3.3333);
    expect(summary.topWinR).toBe(10);
    expect(summary.topThreeWinR).toBe(10);
    expect(summary.topWinShareOfGrossWin).toBe(1);
    expect(summary.topWinShareOfTotal).toBe(1.4286);
    expect(summary.chronological.maxDrawdownR).toBe(-3);
    expect(summary.chronological.minEquityR).toBe(0);
    expect(summary.lossesFirst.maxDrawdownR).toBe(-3);
    expect(summary.lossesFirst.minEquityR).toBe(-3);
    expect(summary.risk.returnPct).toBe(1.75);
    expect(summary.risk.lossesFirstMaxDrawdownPct).toBe(-0.75);
  });

  test("reports loss-streak fragility from shuffled paths", () => {
    const summary = summarizeReaderFragility([
      trade(-1, "2025-05-01"),
      trade(-1, "2025-05-02"),
      trade(4, "2025-05-03"),
      trade(-1, "2025-05-04"),
    ], { monteCarloRuns: 100, seed: 2 });

    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(3);
    expect(summary.grossWinR).toBe(4);
    expect(summary.grossLossR).toBe(-3);
    expect(summary.profitFactor).toBe(1.3333);
    expect(summary.chronological.maxLossStreak).toBe(2);
    expect(summary.lossesFirst.maxLossStreak).toBe(3);
    expect(summary.monteCarlo.maxLossStreak.worst).toBe(3);
  });

  test("nets fee and slippage from each trade in R space", () => {
    const summary = summarizeReaderFragility([
      trade(1, "2025-05-01"),
      trade(0.05, "2025-05-02"),
      trade(-0.5, "2025-05-03"),
    ], {
      riskPct: 0.25,
      feePct: 0.025,
      slippagePct: 0.025,
      monteCarloRuns: 20,
      seed: 3,
    });

    expect(summary.risk.costRPerTrade).toBe(0.2);
    expect(summary.totalR).toBe(-0.05);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(2);
    expect(summary.chronological.maxDrawdownR).toBe(-0.85);
    expect(summary.risk.returnPct).toBe(-0.0125);
  });

  test("handles empty trade lists", () => {
    const summary = summarizeReaderFragility([], { monteCarloRuns: 10 });

    expect(summary.trades).toBe(0);
    expect(summary.totalR).toBe(0);
    expect(summary.grossWinR).toBe(0);
    expect(summary.grossLossR).toBe(0);
    expect(summary.topWinR).toBe(null);
    expect(summary.topWinShareOfGrossWin).toBe(null);
    expect(summary.monteCarlo.maxDrawdownR.worst).toBe(0);
  });
});

function trade(r: number, day: string) {
  return {
    r,
    entryAt: `${day}T00:00:00.000Z`,
  };
}


