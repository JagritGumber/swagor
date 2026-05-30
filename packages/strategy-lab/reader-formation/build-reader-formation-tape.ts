import type { ReaderFormationInput, ReaderFormationRead, ReaderFormationTape } from "./types";
import type { ReaderResultEntry, ReaderResultOutcome } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";

const DEFAULT_BEFORE_ENTRY_READS = 10;
const DEFAULT_AFTER_ENTRY_READS = 5;
const ORDERFLOW_SIGNIFICANT_READ_MULTIPLIER = 2;

export function buildReaderFormationTape(input: ReaderFormationInput): ReaderFormationTape[] {
  const beforeEntryReads = input.beforeEntryReads ?? DEFAULT_BEFORE_ENTRY_READS;
  const afterEntryReads = input.afterEntryReads ?? DEFAULT_AFTER_ENTRY_READS;
  const reads = formationReads(input);

  return input.entries.map((entry) => {
    const outcome = outcomeForEntry(entry, input.outcomes);
    const endAt = outcome?.exitAt ?? Number.POSITIVE_INFINITY;
    const entryReads = reads.filter((read) => readBelongsToEntry(read, entry));
    const beforeEntry = entryReads.filter((read) => read.at <= entry.entryAt);
    return {
      entry,
      outcome,
      beforeEntry: beforeEntry.slice(-beforeEntryReads),
      significantBeforeEntry: significantBeforeEntryReads(beforeEntry, beforeEntryReads * ORDERFLOW_SIGNIFICANT_READ_MULTIPLIER),
      afterEntry: entryReads.filter((read) => read.at > entry.entryAt && read.at <= endAt).slice(0, afterEntryReads),
    };
  });
}

function formationReads(input: ReaderFormationInput): ReaderFormationRead[] {
  const count = Math.max(input.resultUpdates.length, input.setupResults?.length ?? 0, input.historySteps?.length ?? 0);
  const reads: ReaderFormationRead[] = [];

  for (let index = 0; index < count; index += 1) {
    const resultUpdate = input.resultUpdates[index];
    const setupResult = input.setupResults?.[index] ?? resultUpdate?.input;
    if (!setupResult) continue;
    const at = input.historySteps?.[index]?.now ?? eventTimeFor(setupResult, resultUpdate);
    if (at === null) continue;
    reads.push(formationRead({ at, setupResult, resultUpdate }));
  }

  return reads.sort((a, b) => a.at - b.at);
}

function formationRead(input: {
  at: number;
  setupResult: ReaderSetupResult;
  resultUpdate: ReaderFormationInput["resultUpdates"][number] | undefined;
}): ReaderFormationRead {
  const auction = input.setupResult.read.auction;
  const orderflow = input.setupResult.read.orderflow;
  return {
    asset: input.setupResult.read.asset,
    setupKey: setupKeyFor(input.setupResult),
    at: input.at,
    lastPrice: orderflow.lastPrice,
    stance: input.setupResult.read.stance,
    auctionMode: input.setupResult.read.auctionMode,
    narrative: input.setupResult.read.narrativeRead,
    regime: input.setupResult.read.regime,
    auction: {
      location: auction.location,
      bias: auction.bias,
      levelKind: auction.level?.kind ?? null,
      levelPrice: auction.level?.price ?? null,
      poc: auction.profile?.poc ?? null,
      valueAreaLow: auction.profile?.valueAreaLow ?? null,
      valueAreaHigh: auction.profile?.valueAreaHigh ?? null,
    },
    orderflow: {
      pressure: orderflow.pressure,
      delta: orderflow.delta,
      tradeCount: orderflow.tradeCount,
      largestTrade: orderflow.largestTrade,
      evidence: orderflow.evidence,
      tape: orderflow.tape,
      events: [...orderflow.events],
    },
    setup: {
      planSource: input.setupResult.planSource,
      planStatus: input.setupResult.plan.status,
      setupFamily: input.setupResult.plan.setupFamily,
      sequencePhase: input.setupResult.plan.sequencePhase,
      sequenceReason: input.setupResult.plan.sequenceReason,
      eventTypes: input.setupResult.events.map((event) => event.type),
    },
    resultEventTypes: input.resultUpdate?.events.map((event) => event.type) ?? [],
  };
}

function setupKeyFor(setupResult: ReaderSetupResult): string | null {
  return setupResult.setup?.key ?? setupResult.events.find((event) => event.key !== null)?.key ?? null;
}

function readBelongsToEntry(read: ReaderFormationRead, entry: ReaderResultEntry): boolean {
  if (read.asset !== entry.asset) return false;
  return read.setupKey === null || entry.setupKey === null || read.setupKey === entry.setupKey;
}

function significantBeforeEntryReads(reads: ReaderFormationRead[], maxOrderflowReads: number): ReaderFormationRead[] {
  return uniqueReads([
    ...reads.filter(hasSetupOrResultLandmark),
    ...reads.filter(hasOrderflowLandmark).slice(-maxOrderflowReads),
  ]).sort((a, b) => a.at - b.at);
}

function hasSetupOrResultLandmark(read: ReaderFormationRead): boolean {
  return read.setup.eventTypes.some((type) => type !== "setup-none" && type !== "setup-held")
    || read.resultEventTypes.some((type) => type !== "position-held");
}

function hasOrderflowLandmark(read: ReaderFormationRead): boolean {
  return read.orderflow.events.length > 0;
}

function uniqueReads(reads: ReaderFormationRead[]): ReaderFormationRead[] {
  const seen = new Set<string>();
  return reads.filter((read) => {
    const key = `${read.asset}|${read.setupKey ?? ""}|${read.at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventTimeFor(
  setupResult: ReaderSetupResult,
  resultUpdate: ReaderFormationInput["resultUpdates"][number] | undefined,
): number | null {
  const resultEventAt = resultUpdate?.events[0]?.at;
  if (resultEventAt !== undefined) return resultEventAt;
  const setupEventAt = setupResult.events[0]?.at;
  if (setupEventAt !== undefined) return setupEventAt;
  return setupResult.setup?.lastReadAt ?? null;
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
