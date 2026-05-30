import type {
  AnalyzeReaderTradesInput,
  ReaderAnalyzedTrade,
  ReaderAnalysisGroup,
  ReaderAnalysisReport,
  ReaderAnalysisSummary,
  ReaderGuardedAnalysis,
  ReaderNarrativeAudit,
  ReaderNarrativeFailureChain,
  ReaderNarrativeVerdict,
  ReaderPocRotation,
  ReaderTradeQualityLabel,
  ReaderTradeReaction,
  ReaderTradeTiming,
} from "./types";
import type { ReaderTradeDossier } from "../reader-evidence/types";
import type { ReaderFormationRead } from "../reader-formation/types";

const DEFAULT_MIN_COVERAGE_PCT = 90;
const DEFAULT_DAILY_LOSS_LIMIT_R = 3;

export function analyzeReaderTrades(input: AnalyzeReaderTradesInput): ReaderAnalysisReport {
  const minCoveragePct = input.minCoveragePct ?? DEFAULT_MIN_COVERAGE_PCT;
  const analyzed = applyNarrativeFailureState(input.trades.map((dossier) => analyzedTrade({ dossier, minCoveragePct })));
  const judgeable = analyzed.filter((trade) => trade.trust);
  const guarded = dailyLossGuard(judgeable, input.dailyLossLimitR ?? DEFAULT_DAILY_LOSS_LIMIT_R);

  return {
    trades: analyzed,
    summary: summarizeReaderTrades(analyzed),
    groups: {
      byDay: groupedBy(judgeable, dayKey),
      byRegime: groupedBy(judgeable, regimeKey),
      bySetupFamily: groupedBy(judgeable, setupFamilyOnlyKey),
      bySetupFamilyRegime: groupedBy(judgeable, setupFamilyRegimeKey),
      bySequence: groupedBy(judgeable, sequenceKey),
      byNarrative: groupedBy(judgeable, narrativeKey),
      byAuctionMode: groupedBy(judgeable, auctionModeKey),
      byAuctionPhase: groupedBy(judgeable, auctionPhaseKey),
      byOrderflowEvidence: groupedBy(judgeable, orderflowEvidenceKey),
      bySideLocation: groupedBy(judgeable, sideLocationKey),
      byEntryTiming: groupedBy(judgeable, (trade) => trade.metrics.entryTiming),
      byFirstReaction: groupedBy(judgeable, (trade) => trade.metrics.firstReaction),
      byPocRotation: groupedBy(judgeable, (trade) => trade.metrics.pocRotation),
      byQualityLabel: groupedBy(judgeable, qualityLabelKey),
      byNarrativeVerdict: groupedBy(judgeable, (trade) => trade.narrativeAudit.verdict),
      worstFamilies: sortedGroups(groupedBy(judgeable, setupFamilyKey), "worst"),
      bestFamilies: sortedGroups(groupedBy(judgeable, setupFamilyKey), "best"),
      worstNarratives: sortedGroups(groupedBy(judgeable, (trade) => trade.narrativeAudit.key), "worst"),
    },
    narrativeFailureChains: narrativeFailureChains(judgeable),
    guarded,
  };
}

export function summarizeReaderTrades(trades: ReaderAnalyzedTrade[]): ReaderAnalysisSummary {
  const judgeable = trades.filter((trade) => trade.trust);
  const rValues = judgeable.map((trade) => trade.metrics.r ?? 0);
  return {
    registeredTrades: trades.length,
    judgeableTrades: judgeable.length,
    unjudgeableTrades: trades.length - judgeable.length,
    wins: rValues.filter((r) => r > 0).length,
    losses: rValues.filter((r) => r < 0).length,
    totalR: round(sum(rValues)),
    averageR: rValues.length === 0 ? 0 : round(sum(rValues) / rValues.length),
    maxDrawdownR: round(maxDrawdown(rValues)),
  };
}

function analyzedTrade(input: {
  dossier: ReaderTradeDossier;
  minCoveragePct: number;
}): ReaderAnalyzedTrade {
  const trust = trustFor(input);
  const metrics = metricsFor(input.dossier);
  return {
    dossier: input.dossier,
    trust: trust.trust,
    trustReason: trust.reason,
    metrics,
    labels: labelsFor({ trust: trust.trust, metrics, dossier: input.dossier }),
    narrativeAudit: narrativeAuditFor({ trust: trust.trust, metrics, dossier: input.dossier }),
  };
}

function applyNarrativeFailureState(trades: ReaderAnalyzedTrade[]): ReaderAnalyzedTrade[] {
  const failures = new Map<string, number>();
  return [...trades]
    .sort((left, right) => left.dossier.trade.entryAt - right.dossier.trade.entryAt)
    .map((trade) => {
      const chainKey = narrativeChainKey(trade);
      const previousFailures = failures.get(chainKey) ?? 0;
      const isRepeatedFailure = trade.trust && previousFailures >= 2;
      const nextTrade = isRepeatedFailure
        ? {
            ...trade,
            narrativeAudit: {
              ...trade.narrativeAudit,
              verdict: "wrong" as const,
              invalidatingEvidence: unique([
                ...trade.narrativeAudit.invalidatingEvidence,
                "same narrative thesis has already failed twice in this analysis chain",
              ]),
            },
          }
        : trade;

      if (narrativeFailureFor(nextTrade)) failures.set(chainKey, previousFailures + 1);
      return nextTrade;
    });
}

function trustFor(input: {
  dossier: ReaderTradeDossier;
  minCoveragePct: number;
}): { trust: boolean; reason: string } {
  if (input.dossier.execution.quality === "unusable") {
    return {
      trust: false,
      reason: `price coverage ${input.dossier.execution.coveragePctWhileOpen}% below ${input.minCoveragePct}% or long unpriced gap`,
    };
  }
  if (input.dossier.execution.coveragePctWhileOpen < input.minCoveragePct && input.dossier.execution.quality !== "open") {
    return {
      trust: false,
      reason: `price coverage ${input.dossier.execution.coveragePctWhileOpen}% below ${input.minCoveragePct}%`,
    };
  }
  if (input.dossier.verdict === "open-trade") return { trust: false, reason: "trade still open" };
  return { trust: true, reason: "judgeable" };
}

function metricsFor(dossier: ReaderTradeDossier) {
  const trade = dossier.trade;
  const risk = Math.abs(trade.entryPrice - trade.stop);
  const pricedReads = dossier.formation.afterEntry.filter((read) => read.lastPrice !== null);
  const firstReactionR = pricedReads[0]?.lastPrice === undefined || pricedReads[0].lastPrice === null
    ? null
    : signedMoveR({ side: trade.side, entry: trade.entryPrice, price: pricedReads[0].lastPrice, risk });
  const movement = pricedReads.map((read) => signedMoveR({
    side: trade.side,
    entry: trade.entryPrice,
    price: read.lastPrice ?? trade.entryPrice,
    risk,
  }));

  return {
    risk,
    r: trade.r ?? null,
    observedMfeR: movement.length === 0 ? null : round(Math.max(...movement)),
    observedMaeR: movement.length === 0 ? null : round(Math.min(...movement)),
    firstReactionR: firstReactionR === null ? null : round(firstReactionR),
    timeInTradeMs: trade.exitAt === undefined ? null : trade.exitAt - trade.entryAt,
    pricedReadsAfterEntry: pricedReads.length,
    entryTiming: entryTimingFor(dossier),
    firstReaction: firstReactionFor(firstReactionR),
    pocRotation: pocRotationFor(dossier, pricedReads),
  };
}

function labelsFor(input: {
  trust: boolean;
  metrics: ReturnType<typeof metricsFor>;
  dossier: ReaderTradeDossier;
}): ReaderTradeQualityLabel[] {
  const labels: ReaderTradeQualityLabel[] = [];
  if (!input.trust) labels.push("untrusted-result");
  if (input.metrics.firstReaction === "favorable-first-read" && input.metrics.pocRotation !== "moved-away-from-poc") {
    labels.push("clean-continuation");
  }
  if (input.metrics.entryTiming === "away-from-local-extreme") labels.push("late-entry");
  if (input.metrics.firstReaction === "adverse-first-read") labels.push("failed-follow-through");
  if (isAbsorptionTrade(input.dossier) && input.metrics.pocRotation === "moved-away-from-poc") {
    labels.push("absorbed-but-no-rotation");
  }
  if (
    input.metrics.observedMaeR !== null
    && input.metrics.observedMaeR <= -0.5
    && input.metrics.observedMfeR !== null
    && input.metrics.observedMfeR > 0
  ) {
    labels.push("needs-selbo-size-down");
  }
  return labels.length === 0 ? ["unclassified"] : unique(labels);
}

function narrativeAuditFor(input: {
  trust: boolean;
  metrics: ReturnType<typeof metricsFor>;
  dossier: ReaderTradeDossier;
}): ReaderNarrativeAudit {
  const evidence = invalidatingEvidenceFor(input);
  return {
    key: narrativeKeyForDossier(input.dossier),
    verdict: narrativeVerdictFor({ trust: input.trust, r: input.metrics.r, evidence }),
    invalidatingEvidence: evidence,
  };
}

function narrativeVerdictFor(input: {
  trust: boolean;
  r: number | null;
  evidence: string[];
}): ReaderNarrativeVerdict {
  if (!input.trust || input.r === null) return "unjudgeable";
  if (input.evidence.length >= 2 && input.r < 0) return "invalidated";
  if (input.evidence.length > 0 && input.r < 0) return "weak-confirmed";
  if (input.r > 0) return input.evidence.length === 0 ? "confirmed" : "weak-confirmed";
  return input.evidence.length > 0 ? "invalidated" : "weak-confirmed";
}

function invalidatingEvidenceFor(input: {
  metrics: ReturnType<typeof metricsFor>;
  dossier: ReaderTradeDossier;
}): string[] {
  const evidence: string[] = [];
  if (input.metrics.firstReaction === "adverse-first-read") evidence.push("first post-entry read moved against the thesis");
  if (input.metrics.pocRotation === "moved-away-from-poc") evidence.push("price moved away from POC after the narrative");
  if (input.metrics.entryTiming === "middle-of-local-range") evidence.push("entry came from the middle of the local range");
  if (input.metrics.entryTiming === "away-from-local-extreme") evidence.push("entry came away from the expected local extreme");
  if (isAbsorptionTrade(input.dossier) && input.metrics.pocRotation === "moved-away-from-poc") {
    evidence.push("absorption did not create rotation");
  }
  return unique(evidence);
}

function entryTimingFor(dossier: ReaderTradeDossier): ReaderTradeTiming {
  const position = dossier.candles.stats.entryClosePosition;
  if (position === null) return "unknown-local-range";
  if (dossier.trade.side === "long") {
    if (position <= 0.25) return "near-local-extreme";
    if (position <= 0.75) return "middle-of-local-range";
    return "away-from-local-extreme";
  }
  if (position >= 0.75) return "near-local-extreme";
  if (position >= 0.25) return "middle-of-local-range";
  return "away-from-local-extreme";
}

function firstReactionFor(firstReactionR: number | null): ReaderTradeReaction {
  if (firstReactionR === null) return "no-priced-first-read";
  if (firstReactionR > 0) return "favorable-first-read";
  if (firstReactionR < 0) return "adverse-first-read";
  return "flat-first-read";
}

function pocRotationFor(dossier: ReaderTradeDossier, pricedReads: ReaderFormationRead[]): ReaderPocRotation {
  const poc = significantRead({ dossier })?.auction.poc ?? dossier.auction.profile?.poc ?? null;
  const firstPrice = pricedReads[0]?.lastPrice ?? null;
  const lastPrice = pricedReads[pricedReads.length - 1]?.lastPrice ?? null;
  if (poc === null || firstPrice === null || lastPrice === null) return "no-poc-reference";
  const firstDistance = Math.abs(firstPrice - poc);
  const lastDistance = Math.abs(lastPrice - poc);
  const crossed = (firstPrice <= poc && lastPrice >= poc) || (firstPrice >= poc && lastPrice <= poc);
  if (crossed) return "rotated-through-poc";
  if (lastDistance < firstDistance) return "moved-toward-poc";
  return "moved-away-from-poc";
}

function signedMoveR(input: {
  side: ReaderTradeDossier["trade"]["side"];
  entry: number;
  price: number;
  risk: number;
}): number {
  if (input.risk === 0) return 0;
  const raw = input.side === "long" ? input.price - input.entry : input.entry - input.price;
  return raw / input.risk;
}

function groupedBy(trades: ReaderAnalyzedTrade[], keyFor: (trade: ReaderAnalyzedTrade) => string): ReaderAnalysisGroup[] {
  const groups = new Map<string, ReaderAnalyzedTrade[]>();
  for (const trade of trades) {
    const key = keyFor(trade);
    const group = groups.get(key);
    if (group) group.push(trade);
    else groups.set(key, [trade]);
  }
  return [...groups.entries()].map(([key, groupTrades]) => ({
    key,
    trades: groupTrades,
    summary: summarizeReaderTrades(groupTrades),
  }));
}

function dailyLossGuard(trades: ReaderAnalyzedTrade[], dailyLossLimitR: number): ReaderGuardedAnalysis {
  const dayR = new Map<string, number>();
  const stoppedDays = new Set<string>();
  const kept: ReaderAnalyzedTrade[] = [];
  let skipped = 0;

  for (const trade of [...trades].sort((a, b) => a.dossier.trade.entryAt - b.dossier.trade.entryAt)) {
    const day = dayKey(trade);
    if (stoppedDays.has(day)) {
      skipped += 1;
      continue;
    }
    kept.push(trade);
    const nextR = (dayR.get(day) ?? 0) + (trade.metrics.r ?? 0);
    dayR.set(day, nextR);
    if (nextR <= -dailyLossLimitR) stoppedDays.add(day);
  }

  return {
    trades: kept,
    skipped,
    summary: summarizeReaderTrades(kept),
  };
}

function sortedGroups(groups: ReaderAnalysisGroup[], order: "worst" | "best"): ReaderAnalysisGroup[] {
  return [...groups].sort((left, right) => {
    if (order === "worst") return left.summary.totalR - right.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
    return right.summary.totalR - left.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
  });
}

function narrativeFailureChains(trades: ReaderAnalyzedTrade[]): ReaderNarrativeFailureChain[] {
  return sortedGroups(groupedBy(
    trades.filter(narrativeFailureFor),
    narrativeChainKey,
  ), "worst")
    .filter((group) => group.trades.length >= 2)
    .map((group) => {
      const [day, ...keyParts] = group.key.split("|");
      return {
        key: keyParts.join("|"),
        day,
        trades: group.trades,
        losses: group.trades.filter((trade) => (trade.metrics.r ?? 0) < 0).length,
        totalR: group.summary.totalR,
      };
    });
}

function narrativeFailureFor(trade: ReaderAnalyzedTrade): boolean {
  if (!trade.trust) return false;
  if ((trade.metrics.r ?? 0) >= 0) return false;
  return trade.narrativeAudit.verdict === "invalidated" || trade.narrativeAudit.verdict === "wrong";
}

function narrativeChainKey(trade: ReaderAnalyzedTrade): string {
  return `${dayKey(trade)}|${trade.narrativeAudit.key}`;
}

function dayKey(trade: ReaderAnalyzedTrade): string {
  return iso(trade.dossier.trade.entryAt).slice(0, 10);
}

function setupFamilyKey(trade: ReaderAnalyzedTrade): string {
  const read = significantRead(trade);
  const location = read?.auction.location ?? trade.dossier.auction.location;
  const levelKind = read?.auction.levelKind ?? trade.dossier.auction.level?.kind ?? "level";
  const pressure = read?.orderflow.pressure ?? trade.dossier.orderflow.pressure;
  const events = eventFamily(read?.orderflow.events ?? trade.dossier.orderflow.events);
  return `${setupFamilyOnlyKey(trade)}|${trade.dossier.trade.side}|${location}|${levelKind}|${pressure}|${events}`;
}

function setupFamilyOnlyKey(trade: ReaderAnalyzedTrade): string {
  return trade.dossier.trade.setupFamily ?? "legacy";
}

function regimeKey(trade: ReaderAnalyzedTrade): string {
  return trade.dossier.trade.regime?.mode ?? "unknown";
}

function setupFamilyRegimeKey(trade: ReaderAnalyzedTrade): string {
  return `${setupFamilyOnlyKey(trade)}|${regimeKey(trade)}`;
}

function sequenceKey(trade: ReaderAnalyzedTrade): string {
  return `${setupFamilyOnlyKey(trade)}|${trade.dossier.trade.sequencePhase ?? "n/a"}`;
}

function narrativeKey(trade: ReaderAnalyzedTrade): string {
  return narrativeKeyForDossier(trade.dossier);
}

function auctionModeKey(trade: ReaderAnalyzedTrade): string {
  return trade.dossier.trade.auctionMode?.mode
    ?? trade.dossier.auctionMode?.mode
    ?? "unknown";
}

function auctionPhaseKey(trade: ReaderAnalyzedTrade): string {
  return trade.dossier.trade.auctionMode?.phase
    ?? trade.dossier.auctionMode?.phase
    ?? "unknown";
}

function narrativeKeyForDossier(dossier: ReaderTradeDossier): string {
  const narrative = dossier.trade.narrative ?? significantRead({ dossier })?.narrative;
  if (!narrative) return "no-narrative";
  return `${narrative.intent}|${narrative.direction}|${narrative.participation}|${narrative.levelStory}`;
}

function orderflowEvidenceKey(trade: ReaderAnalyzedTrade): string {
  const orderflow = significantRead(trade)?.orderflow ?? trade.dossier.orderflow;
  const evidence = orderflow.evidence;
  if (!evidence) return "no-evidence";
  return `pressure=${evidence.pressure}|absorption=${evidence.absorption}|print=${evidence.print}|follow=${evidence.followThrough}`;
}

function sideLocationKey(trade: ReaderAnalyzedTrade): string {
  const read = significantRead(trade);
  const location = read?.auction.location ?? trade.dossier.auction.location;
  const levelKind = read?.auction.levelKind ?? trade.dossier.auction.level?.kind ?? "level";
  return `${trade.dossier.trade.side}|${location}|${levelKind}`;
}

function qualityLabelKey(trade: ReaderAnalyzedTrade): string {
  return trade.labels.join("+");
}

function significantRead(trade: Pick<ReaderAnalyzedTrade, "dossier">): ReaderFormationRead | null {
  return trade.dossier.formation.significantBeforeEntry[trade.dossier.formation.significantBeforeEntry.length - 1] ?? null;
}

function isAbsorptionTrade(dossier: ReaderTradeDossier): boolean {
  const events = significantRead({ dossier })?.orderflow.events ?? dossier.orderflow.events;
  return events.includes("aggressive-absorption") || events.includes("confirmed-absorption");
}

function eventFamily(events: string[]): string {
  const labels: string[] = [];
  if (events.includes("stalled-selling")) labels.push("stalled-selling");
  if (events.includes("stalled-buying")) labels.push("stalled-buying");
  if (events.includes("large-print")) labels.push("large-print");
  if (events.includes("aggressive-absorption")) labels.push("aggressive-absorption");
  if (events.includes("confirmed-absorption")) labels.push("confirmed-absorption");
  if (labels.length === 0 && events.includes("thin-follow-through")) labels.push("thin-follow-through");
  return labels.length === 0 ? "no-event" : labels.join("+");
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function maxDrawdown(rValues: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of rValues) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return maxDd;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function iso(time: number): string {
  return new Date(time).toISOString();
}
