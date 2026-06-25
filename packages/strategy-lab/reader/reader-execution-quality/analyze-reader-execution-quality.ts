import type {
  ReaderExecutionDiagnosis,
  ReaderExecutionQuality,
  ReaderExecutionQualityInput,
  ReaderExecutionQualityReport,
  ReaderTradeExecutionQualityReport,
} from "./types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome } from "../reader-result/types";

const DEFAULT_UNUSABLE_COVERAGE_PCT = 80;
const DEFAULT_UNUSABLE_UNPRICED_RUN = 3;

type ObservedPriceEvent = {
  type: "priced" | "unpriced";
  at: number;
};

export function analyzeReaderExecutionQuality(input: ReaderExecutionQualityInput): ReaderExecutionQualityReport {
  const observations = observedPriceEvents(input.replay.resultUpdates.flatMap((update) => update.events));
  const pricedReads = observations.filter((event) => event.type === "priced").length;
  const unpricedReads = observations.filter((event) => event.type === "unpriced").length;
  const trades = input.replay.entries.map((entry) => tradeQuality({
    entry,
    outcome: outcomeForEntry(entry, input.replay.outcomes),
    isOpen: Boolean(input.replay.open && sameEntry(entry, input.replay.open)),
    observations,
    readIntervalMs: input.readIntervalMs,
    unusableCoveragePct: input.unusableCoveragePct ?? DEFAULT_UNUSABLE_COVERAGE_PCT,
    unusableUnpricedRun: input.unusableUnpricedRun ?? DEFAULT_UNUSABLE_UNPRICED_RUN,
  }));

  return {
    totalObservedReads: observations.length,
    pricedReads,
    unpricedReads,
    priceCoveragePct: coveragePct(pricedReads, observations.length),
    longestUnpricedRun: longestUnpricedRun(observations),
    longestUnpricedGapMs: gapMs(longestUnpricedRun(observations), input.readIntervalMs),
    firstPricedAt: firstPricedAt(observations),
    lastPricedAt: lastPricedAt(observations),
    replayQuality: worstQuality(trades.map((trade) => trade.quality)),
    trades,
  };
}

function tradeQuality(input: {
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  isOpen: boolean;
  observations: ObservedPriceEvent[];
  readIntervalMs?: number;
  unusableCoveragePct: number;
  unusableUnpricedRun: number;
}): ReaderTradeExecutionQualityReport {
  const endAt = input.outcome?.exitAt ?? Number.POSITIVE_INFINITY;
  const openObservations = input.observations.filter((event) => event.at >= input.entry.entryAt && event.at <= endAt);
  const pricedReads = openObservations.filter((event) => event.type === "priced").length;
  const unpricedReads = openObservations.filter((event) => event.type === "unpriced").length;
  const longestRun = longestUnpricedRun(openObservations);
  const pct = coveragePct(pricedReads, openObservations.length);
  const quality = qualityFor({
    isOpen: input.isOpen,
    unpricedReads,
    coveragePct: pct,
    longestUnpricedRun: longestRun,
    unusableCoveragePct: input.unusableCoveragePct,
    unusableUnpricedRun: input.unusableUnpricedRun,
  });

  return {
    entry: input.entry,
    outcome: input.outcome,
    pricedReadsWhileOpen: pricedReads,
    unpricedReadsWhileOpen: unpricedReads,
    coveragePctWhileOpen: pct,
    longestUnpricedRunWhileOpen: longestRun,
    longestUnpricedGapMsWhileOpen: gapMs(longestRun, input.readIntervalMs),
    quality,
    diagnosis: diagnosisFor({
      quality,
      unpricedReads,
      coveragePct: pct,
      longestUnpricedRun: longestRun,
      unusableCoveragePct: input.unusableCoveragePct,
      unusableUnpricedRun: input.unusableUnpricedRun,
    }),
  };
}

function observedPriceEvents(events: ReaderResultEvent[]): ObservedPriceEvent[] {
  return events
    .flatMap((event): ObservedPriceEvent[] => {
      if (event.type === "position-unpriced") return [{ type: "unpriced", at: event.at }];
      if (
        event.type === "position-held"
        || event.type === "stop-hit"
        || event.type === "target-hit"
        || event.type === "reader-failure-exit"
      ) return [{ type: "priced", at: event.at }];
      return [];
    })
    .sort((a, b) => a.at - b.at);
}

function qualityFor(input: {
  isOpen: boolean;
  unpricedReads: number;
  coveragePct: number;
  longestUnpricedRun: number;
  unusableCoveragePct: number;
  unusableUnpricedRun: number;
}): ReaderExecutionQuality {
  if (input.isOpen) return "open";
  if (input.coveragePct < input.unusableCoveragePct) return "unusable";
  if (input.longestUnpricedRun >= input.unusableUnpricedRun) return "unusable";
  if (input.unpricedReads > 0) return "degraded";
  return "clean";
}

function diagnosisFor(input: {
  quality: ReaderExecutionQuality;
  unpricedReads: number;
  coveragePct: number;
  longestUnpricedRun: number;
  unusableCoveragePct: number;
  unusableUnpricedRun: number;
}): ReaderExecutionDiagnosis {
  if (input.quality === "open") return "open-trade";
  if (input.longestUnpricedRun >= input.unusableUnpricedRun) return "long-unpriced-gap";
  if (input.coveragePct < input.unusableCoveragePct) return "sparse-price-coverage";
  if (input.unpricedReads > 0) return "missing-price-while-open";
  return "clean-price-coverage";
}

function coveragePct(pricedReads: number, totalObservedReads: number): number {
  if (totalObservedReads === 0) return 0;
  return Number(((pricedReads / totalObservedReads) * 100).toFixed(2));
}

function longestUnpricedRun(events: ObservedPriceEvent[]): number {
  let current = 0;
  let longest = 0;
  for (const event of events) {
    if (event.type === "unpriced") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function gapMs(run: number, readIntervalMs: number | undefined): number | null {
  return readIntervalMs === undefined ? null : run * readIntervalMs;
}

function firstPricedAt(events: ObservedPriceEvent[]): number | null {
  return events.find((event) => event.type === "priced")?.at ?? null;
}

function lastPricedAt(events: ObservedPriceEvent[]): number | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === "priced") return events[i].at;
  }
  return null;
}

function outcomeForEntry(entry: ReaderResultEntry, outcomes: ReaderResultOutcome[]): ReaderResultOutcome | null {
  return outcomes.find((outcome) => sameEntry(entry, outcome)) ?? null;
}

function sameEntry(left: ReaderResultEntry, right: ReaderResultEntry): boolean {
  return left.asset === right.asset
    && left.side === right.side
    && left.entryAt === right.entryAt
    && left.entryPrice === right.entryPrice
    && left.stop === right.stop
    && left.target === right.target;
}

function worstQuality(qualities: ReaderExecutionQuality[]): ReaderExecutionQuality {
  if (qualities.includes("unusable")) return "unusable";
  if (qualities.includes("degraded")) return "degraded";
  if (qualities.includes("open")) return "open";
  return "clean";
}



