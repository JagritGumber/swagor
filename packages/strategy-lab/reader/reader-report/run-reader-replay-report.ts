import { intervalMs, readVmCandles } from "../../../market-data";
import { analyzeReaderExecutionQuality } from "../reader-execution-quality/analyze-reader-execution-quality";
import { buildReaderEvidenceReport } from "../reader-evidence/build-reader-evidence-report";
import { runReaderHistoryReplay } from "../reader-history/run-reader-history-replay";
import { readReportOrderflowEvents } from "./read-report-orderflow-events";
import type { ReaderReplayReport, ReaderReplayReportInput } from "./types";
import type { OrderflowEvent } from "../../read-core/orderflow/types";
import type { Candle } from "../../types";

export async function runReaderReplayReport(input: ReaderReplayReportInput): Promise<ReaderReplayReport> {
  const candles = await readVmCandles(input);
  const candleIntervalMs = intervalMs(input.interval);
  const orderflow = await readReportOrderflowEvents(input);
  const replay = runReaderHistoryReplay({
    asset: input.asset,
    interval: input.interval,
    candleIntervalMs,
    candles,
    orderflowEvents: orderflow.events,
    readIntervalMs: input.readIntervalMs,
    orderflowWindowMs: input.orderflowWindowMs,
    startAt: input.startMs,
    endAt: input.endMs,
    auctionConfig: input.auctionConfig,
    replay: {
      setupConfig: {
        setupTtlMs: input.setupTtlMs,
      },
    },
  });
  const executionQuality = analyzeReaderExecutionQuality({
    readIntervalMs: input.readIntervalMs,
    replay,
  });

  return {
    ...replay,
    diagnostics: {
      candleCount: candles.length,
      orderflowEventCount: orderflow.events.length,
      historyStepCount: replay.historySteps.length,
      missingOrderflowFiles: orderflow.missingFiles,
      firstCandleAt: firstTime(candles),
      lastCandleAt: lastTime(candles),
      firstOrderflowAt: firstEventTime(orderflow.events),
      lastOrderflowAt: lastEventTime(orderflow.events),
    },
    executionQuality,
    evidence: buildReaderEvidenceReport({
      candles,
      candleIntervalMs,
      readIntervalMs: input.readIntervalMs,
      executionQuality,
      replay,
    }),
  };
}

function firstTime(candles: Candle[]): number | null {
  return candles[0]?.t ?? null;
}

function lastTime(candles: Candle[]): number | null {
  return candles[candles.length - 1]?.t ?? null;
}

function firstEventTime(events: OrderflowEvent[]): number | null {
  const event = events[0];
  return event === undefined ? null : eventTime(event);
}

function lastEventTime(events: OrderflowEvent[]): number | null {
  const event = events[events.length - 1];
  return event === undefined ? null : eventTime(event);
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.bbo.time;
}



