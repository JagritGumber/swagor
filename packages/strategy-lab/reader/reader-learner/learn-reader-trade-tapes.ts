import type {
  ReaderLearnerGuidance,
  ReaderLearnerInput,
  ReaderLearnerLesson,
  ReaderLearnerReport,
  ReaderLearnerReplayDecision,
  ReaderLearnerReplayReport,
  ReaderLearnerReplayTrade,
  ReaderLearnerSummary,
  ReaderTradeTape,
  ReaderTradeTapeTrade,
} from "./types";

const DEFAULT_MINIMUM_SAMPLE_FOR_GUIDANCE = 5;

type TradeGroup = {
  key: string;
  trades: ReaderTradeTapeTrade[];
};

export function learnReaderTradeTapes(input: ReaderLearnerInput): ReaderLearnerReport {
  const minimumSample = input.minimumSampleForGuidance ?? DEFAULT_MINIMUM_SAMPLE_FOR_GUIDANCE;
  const trades = input.tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
  const judgeable = trades.filter((trade) => trade.trust && trade.result.r !== null);
  const untrusted = trades.filter((trade) => !trade.trust || trade.result.r === null);
  const lessons = groupedTrades(judgeable, entryFingerprintFor)
    .map((group) => lessonFor({ group, minimumSample, outcomeKey: null }))
    .sort((left, right) => right.summary.judgeableTrades - left.summary.judgeableTrades || right.summary.totalR - left.summary.totalR);
  const dataQualityLessons = groupedTrades(untrusted, entryFingerprintFor)
    .map((group) => lessonFor({ group, minimumSample, outcomeKey: outcomeFingerprintFor(group.trades) }));

  return {
    summary: summaryFor(trades),
    playbookLessons: ranked(lessons.filter((lesson) => lesson.guidance === "candidate-allow"), "best"),
    avoidLessons: ranked(lessons.filter((lesson) => lesson.guidance === "avoid"), "worst"),
    scaleLessons: ranked(lessons.filter((lesson) => lesson.guidance === "reduce-size"), "worst"),
    sampleWarnings: lessons.filter((lesson) => lesson.sampleWarning !== null),
    dataQualityLessons,
  };
}

export function replayReaderAfterLearning(input: {
  learner: ReaderLearnerReport;
  tapes: ReaderTradeTape[];
  useSampleWarningLessons?: boolean;
}): ReaderLearnerReplayReport {
  const trades = input.tapes.flatMap((tape) => tape.assets.flatMap((asset) => asset.trades));
  const avoid = lessonMap(actionableLessons(input.learner.avoidLessons, input.useSampleWarningLessons ?? false));
  const reduceSize = lessonMap(actionableLessons(input.learner.scaleLessons, input.useSampleWarningLessons ?? false));
  const reviewed = trades.map((trade) => replayTradeFor({ trade, avoid, reduceSize }));
  const kept = reviewed.filter((item) => item.decision !== "skipped-future-avoid").map((item) => item.trade);
  const skipped = reviewed.filter((item) => item.decision === "skipped-future-avoid").map((item) => item.trade);

  return {
    baseline: summaryFor(trades),
    learned: summaryFor(kept),
    skipped: summaryFor(skipped),
    trades: reviewed,
  };
}

function groupedTrades(trades: ReaderTradeTapeTrade[], keyFor: (trade: ReaderTradeTapeTrade) => string): TradeGroup[] {
  const groups = new Map<string, ReaderTradeTapeTrade[]>();
  for (const trade of trades) {
    const key = keyFor(trade);
    const existing = groups.get(key);
    if (existing) existing.push(trade);
    else groups.set(key, [trade]);
  }
  return [...groups.entries()].map(([key, groupTrades]) => ({ key, trades: groupTrades }));
}

function replayTradeFor(input: {
  trade: ReaderTradeTapeTrade;
  avoid: Map<string, ReaderLearnerLesson>;
  reduceSize: Map<string, ReaderLearnerLesson>;
}): ReaderLearnerReplayTrade {
  if (!input.trade.trust || input.trade.result.r === null) {
    return {
      trade: input.trade,
      decision: "kept-needs-more-sample",
      lessonKey: null,
      reasons: [input.trade.trustReason],
    };
  }

  const key = entryFingerprintFor(input.trade);
  const avoidLesson = input.avoid.get(key);
  if (avoidLesson) {
    return {
      trade: input.trade,
      decision: "skipped-future-avoid",
      lessonKey: key,
      reasons: avoidLesson.reasons,
    };
  }
  const scaleLesson = input.reduceSize.get(key);
  if (scaleLesson) {
    return {
      trade: input.trade,
      decision: "kept-reduce-size-candidate",
      lessonKey: key,
      reasons: scaleLesson.reasons,
    };
  }
  return {
    trade: input.trade,
    decision: "kept",
    lessonKey: null,
    reasons: [],
  };
}

function lessonMap(lessons: ReaderLearnerLesson[]): Map<string, ReaderLearnerLesson> {
  return new Map(lessons.map((lesson) => [lesson.key, lesson]));
}

function actionableLessons(lessons: ReaderLearnerLesson[], includeSampleWarnings: boolean): ReaderLearnerLesson[] {
  if (includeSampleWarnings) return lessons;
  return lessons.filter((lesson) => lesson.sampleWarning === null);
}

function entryFingerprintFor(trade: ReaderTradeTapeTrade): string {
  return [
    trade.side,
    trade.setupFamily ?? "no-setup-family",
    trade.readerState.auctionLocation ?? "no-auction-location",
    trade.readerState.auctionLevelKind ?? "no-level-kind",
    trade.readerState.auctionMode ?? "no-auction-mode",
    trade.vp.auction ?? "no-vp-auction",
    trade.vp.poc ?? "no-vp-poc",
    trade.vp.value ?? "no-vp-value",
    trade.narrative.intent ?? "no-narrative-intent",
    trade.narrative.direction ?? "no-narrative-direction",
    trade.narrative.participation ?? "no-participation",
    trade.orderflow.pressure,
    eventFamily(trade.orderflow.events),
  ].join("|");
}

function outcomeFingerprintFor(trades: ReaderTradeTapeTrade[]): string {
  const outcomes = new Set(trades.map((trade) => [
    trade.diagnostics.firstReaction,
    trade.diagnostics.pocRotation,
    trade.narrative.verdict,
    trade.diagnostics.labels.join("+") || "no-labels",
  ].join("|")));
  return [...outcomes].sort().join(" || ");
}

function eventFamily(events: string[]): string {
  if (events.length === 0) return "no-orderflow-event";
  return [...events].sort().join("+");
}

function lessonFor(input: {
  group: TradeGroup;
  minimumSample: number;
  outcomeKey: string | null;
}): ReaderLearnerLesson {
  const summary = summaryFor(input.group.trades);
  const sampleWarning = summary.judgeableTrades < input.minimumSample
    ? `only ${summary.judgeableTrades} judgeable trades; do not treat this as edge`
    : null;
  const reasons = reasonsFor({ trades: input.group.trades, summary, sampleWarning });
  return {
    key: input.group.key,
    outcomeKey: input.outcomeKey,
    guidance: guidanceFor({ trades: input.group.trades, summary, sampleWarning }),
    summary,
    sampleWarning,
    reasons,
    tradeRefs: input.group.trades.map(tradeRefFor),
  };
}

function guidanceFor(input: {
  trades: ReaderTradeTapeTrade[];
  summary: ReaderLearnerSummary;
  sampleWarning: string | null;
}): ReaderLearnerGuidance {
  if (input.summary.judgeableTrades === 0) return "needs-more-sample";
  if (input.summary.totalR < 0 && input.summary.losses >= input.summary.wins) return "avoid";
  if (input.trades.some(needsScaleDown)) return "reduce-size";
  if (input.summary.totalR > 0 && input.summary.wins >= input.summary.losses) return input.sampleWarning ? "needs-more-sample" : "candidate-allow";
  return "needs-more-sample";
}

function reasonsFor(input: {
  trades: ReaderTradeTapeTrade[];
  summary: ReaderLearnerSummary;
  sampleWarning: string | null;
}): string[] {
  const reasons: string[] = [];
  if (input.sampleWarning) reasons.push(input.sampleWarning);
  if (input.summary.totalR < 0) reasons.push(`negative expectancy: ${round(input.summary.totalR)}R total`);
  if (input.summary.losses > 0) reasons.push(`${input.summary.losses} full or partial losses`);
  if (input.trades.some((trade) => trade.diagnostics.pocRotation === "moved-away-from-poc")) {
    reasons.push("contains trades where price moved away from POC after entry");
  }
  if (input.trades.some((trade) => trade.diagnostics.firstReaction === "adverse-first-read")) {
    reasons.push("contains adverse first post-entry reads");
  }
  if (input.trades.some(needsScaleDown)) {
    reasons.push("contains size-down evidence from MAE or diagnostic labels");
  }
  if (input.summary.totalR > 0 && input.summary.wins >= input.summary.losses) {
    reasons.push(`positive tape: ${input.summary.wins} wins / ${input.summary.losses} losses`);
  }
  return unique(reasons);
}

function needsScaleDown(trade: ReaderTradeTapeTrade): boolean {
  return trade.diagnostics.labels.includes("needs-selbo-size-down");
}

function summaryFor(trades: ReaderTradeTapeTrade[]): ReaderLearnerSummary {
  const judgeable = trades.filter((trade) => trade.trust && trade.result.r !== null);
  const rValues = judgeable.map((trade) => trade.result.r ?? 0);
  const wins = rValues.filter((r) => r > 0).length;
  const losses = rValues.filter((r) => r < 0).length;
  const totalR = round(sum(rValues));
  return {
    registeredTrades: trades.length,
    judgeableTrades: judgeable.length,
    unjudgeableTrades: trades.length - judgeable.length,
    wins,
    losses,
    totalR,
    averageR: rValues.length === 0 ? 0 : round(totalR / rValues.length),
    maxDrawdownR: round(maxDrawdown(rValues)),
    winRate: rValues.length === 0 ? 0 : round(wins / rValues.length),
  };
}

function ranked(lessons: ReaderLearnerLesson[], order: "best" | "worst"): ReaderLearnerLesson[] {
  return [...lessons].sort((left, right) => {
    if (order === "best") return right.summary.totalR - left.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
    return left.summary.totalR - right.summary.totalR || right.summary.judgeableTrades - left.summary.judgeableTrades;
  });
}

function tradeRefFor(trade: ReaderTradeTapeTrade): string {
  return `${trade.asset}#${trade.index}@${trade.entryAt}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function maxDrawdown(values: number[]): number {
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.min(drawdown, equity - peak);
  }
  return drawdown;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}


