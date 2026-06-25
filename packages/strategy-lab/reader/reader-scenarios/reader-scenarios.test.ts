import { describe, expect, test } from "bun:test";
import { analyzeReaderExecutionQuality } from "../reader-execution-quality/analyze-reader-execution-quality";
import { buildReaderEvidenceReport } from "../reader-evidence/build-reader-evidence-report";
import { runReaderHistoryReplay } from "../reader-history/run-reader-history-replay";
import { chopNearPocNoTrade, deadOrderflowAfterEntry, supportRejectionWithSellerFailure } from "./index";
import type { ReaderScenario } from "./types";

describe("reader scenarios", () => {
  test("support rejection with seller failure earns a long trade dossier from raw market data", () => {
    const result = runScenario(supportRejectionWithSellerFailure());

    expect(result.replay.entries).toHaveLength(1);
    expect(result.replay.entries[0]?.side).toBe("long");
    expect(result.replay.outcomes[0]?.exitReason).toBe("target");
    expect(result.evidence.trades).toHaveLength(1);
    expect(result.evidence.trades[0]?.setup.planSource).toBe("memory-promoted");
    expect(result.evidence.trades[0]?.setup.events.map((event) => event.type)).toContain("setup-created");
    expect(result.evidence.trades[0]?.setup.events.map((event) => event.type)).toContain("setup-ready");
    expect(result.evidence.trades[0]?.auction.location).toBe("value-low");
    expect(result.evidence.trades[0]?.auction.level?.kind).toBe("support");
    expect(result.evidence.trades[0]?.orderflow.pressure).toBe("sell-pressure");
    expect(result.evidence.trades[0]?.orderflow.events).toContain("stalled-selling");
    expect(result.evidence.trades[0]?.formation.beforeEntry.length).toBeGreaterThan(0);
    expect(result.evidence.trades[0]?.formation.afterEntry.length).toBeGreaterThan(0);
    expect(result.evidence.trades[0]?.formation.beforeEntry.some((read) => read.setup.eventTypes.includes("setup-created"))).toBe(true);
    expect(result.evidence.trades[0]?.formation.beforeEntry.some((read) => read.setup.eventTypes.includes("setup-ready"))).toBe(true);
    expect(result.evidence.trades[0]?.formation.beforeEntry.some((read) => read.orderflow.events.includes("stalled-selling"))).toBe(true);
    expect(result.evidence.trades[0]?.formation.significantBeforeEntry.some((read) => read.setup.eventTypes.includes("setup-created"))).toBe(true);
    expect(result.evidence.trades[0]?.formation.significantBeforeEntry.some((read) => read.orderflow.events.includes("stalled-selling"))).toBe(true);
    expect(result.evidence.trades[0]?.verdict).toBe("valid-setup-good-outcome");
  });

  test("dead orderflow after entry makes the result unusable instead of trusted", () => {
    const result = runScenario(deadOrderflowAfterEntry());

    expect(result.replay.entries).toHaveLength(1);
    expect(result.replay.outcomes[0]?.exitReason).toBe("stop");
    expect(result.execution.replayQuality).toBe("unusable");
    expect(result.execution.trades[0]?.diagnosis).toBe("long-unpriced-gap");
    expect(result.evidence.trades[0]?.verdict).toBe("result-unusable-price-coverage");
  });

  test("balanced chop near POC produces no entries or trade dossiers", () => {
    const result = runScenario(chopNearPocNoTrade());

    expect(result.replay.entries).toHaveLength(0);
    expect(result.replay.outcomes).toHaveLength(0);
    expect(result.evidence.trades).toHaveLength(0);
    expect(result.evidence.dataQuality.tradeCount).toBe(0);
  });
});

function runScenario(scenario: ReaderScenario) {
  const replay = runReaderHistoryReplay({
    asset: scenario.asset,
    interval: scenario.interval,
    candleIntervalMs: scenario.candleIntervalMs,
    candles: scenario.candles,
    orderflowEvents: scenario.orderflowEvents,
    readIntervalMs: scenario.readIntervalMs,
    orderflowWindowMs: scenario.orderflowWindowMs,
    startAt: scenario.startAt,
    endAt: scenario.endAt,
    auctionConfig: scenario.auctionConfig,
    replay: {
      setupConfig: { setupTtlMs: 10_000 },
    },
  });
  const execution = analyzeReaderExecutionQuality({
    readIntervalMs: scenario.readIntervalMs,
    replay,
  });
  const evidence = buildReaderEvidenceReport({
    candles: scenario.candles,
    candleIntervalMs: scenario.candleIntervalMs,
    readIntervalMs: scenario.readIntervalMs,
    executionQuality: execution,
    replay,
  });

  return { replay, execution, evidence };
}


