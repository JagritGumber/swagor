import { describe, expect, test } from "bun:test";
import { summarizeReaderEquity } from "./summarize-reader-equity";

describe("summarizeReaderEquity", () => {
  test("reports profitable sequences without underwater capital", () => {
    const summary = summarizeReaderEquity([
      trade(1, "2025-05-01"),
      trade(2, "2025-05-02"),
    ], { riskPct: 0.5, initialCapital: 10_000 });

    expect(summary.totalR).toBe(3);
    expect(summary.maxDrawdownR).toBe(0);
    expect(summary.minEquityR).toBe(0);
    expect(summary.minEquityAt).toBe("start");
    expect(summary.returnPct).toBe(1.5);
    expect(summary.capitalRequiredAtRiskPct).toBe(10_000);
  });

  test("dates the worst underwater point from starting equity", () => {
    const summary = summarizeReaderEquity([
      trade(-2, "2025-05-01"),
      trade(1, "2025-05-02"),
      trade(-3, "2025-05-03"),
    ], { riskPct: 1, initialCapital: 10_000 });

    expect(summary.totalR).toBe(-4);
    expect(summary.minEquityR).toBe(-4);
    expect(summary.minEquityAt).toBe("2025-05-03");
    expect(summary.maxDrawdownR).toBe(-4);
    expect(summary.maxDrawdownAt).toBe("2025-05-03");
    expect(summary.capitalRequiredAtRiskPct).toBe(10_400);
  });

  test("separates peak-to-trough drawdown from starting capital loss", () => {
    const summary = summarizeReaderEquity([
      trade(10, "2025-05-01"),
      trade(-4, "2025-05-02"),
      trade(-3, "2025-05-03"),
    ], { riskPct: 0.25 });

    expect(summary.totalR).toBe(3);
    expect(summary.maxDrawdownR).toBe(-7);
    expect(summary.maxDrawdownFrom).toBe("2025-05-01");
    expect(summary.maxDrawdownAt).toBe("2025-05-03");
    expect(summary.minEquityR).toBe(0);
    expect(summary.minEquityAt).toBe("start");
  });

  test("handles empty trade lists", () => {
    const summary = summarizeReaderEquity([], { riskPct: 0.25 });

    expect(summary.totalR).toBe(0);
    expect(summary.maxDrawdownAt).toBe("never");
    expect(summary.minEquityAt).toBe("start");
  });
});

function trade(r: number, day: string) {
  return {
    r,
    entryAt: Date.parse(`${day}T00:00:00.000Z`),
    exitAt: Date.parse(`${day}T00:05:00.000Z`),
  };
}



