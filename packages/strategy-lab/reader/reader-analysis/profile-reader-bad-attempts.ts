export type ReaderBadAttemptTrade = {
  index: number;
  asset: string;
  entryAt: string;
  side: string;
  setupFamily: string | null;
  trust: boolean;
  result: {
    r: number | null;
  };
  readerState: {
    regime: string | null;
    auctionLocation: string | null;
    auctionLevelKind: string | null;
    auctionMode: string | null;
    auctionPhase: string | null;
  };
  absorptionQuality: {
    quality?: string | null;
    side?: string | null;
    absorbedSide?: string | null;
    priceToPoc?: string | null;
    targetMovesTowardPoc?: boolean | null;
  } | null;
  narrative: {
    key: string | null;
    intent: string | null;
    verdict: string | null;
    invalidatingEvidence: string[];
  };
  vp: {
    auction: string | null;
    poc: string | null;
    value: string | null;
  };
  orderflow: {
    pressure: string | null;
    events: string[];
    initiative?: {
      side?: string | null;
      conviction?: string | null;
      reasons?: string[];
    } | null;
  };
  diagnostics: {
    firstReaction: string | null;
    firstReactionR: number | null;
    observedMfeR: number | null;
    observedMaeR: number | null;
    entryTiming: string | null;
    pocRotation: string | null;
    labels: string[];
  };
};

export type ReaderBadAttemptSummary = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  costRPerTrade: number;
  rawTotalR: number;
  grossWinR: number;
  grossLossR: number;
  profitFactor: number | null;
  totalR: number;
  averageR: number;
  bestR: number | null;
  worstR: number | null;
  maxDrawdownR: number;
  minEquityR: number;
  lossesFirstMaxDrawdownR: number;
  lossesFirstMinEquityR: number;
  maxLossStreak: number;
};

export type ReaderBadAttemptGroup = {
  key: string;
  summary: ReaderBadAttemptSummary;
  refs: string[];
};

export type ReaderBadAttemptReport = {
  summary: ReaderBadAttemptSummary;
  badAttemptGroups: ReaderBadAttemptGroup[];
  winnerGroups: ReaderBadAttemptGroup[];
  featureGroups: ReaderBadAttemptGroup[];
};

export function profileReaderBadAttempts(input: {
  trades: ReaderBadAttemptTrade[];
  minimumGroupSize: number;
  costRPerTrade?: number;
}): ReaderBadAttemptReport {
  const trades = input.trades.filter((trade) => trade.trust && trade.result.r !== null);
  const costRPerTrade = input.costRPerTrade ?? 0;
  return {
    summary: summarize(trades, costRPerTrade),
    badAttemptGroups: groupsFor(trades, badAttemptKey, costRPerTrade)
      .filter((group) => group.summary.trades >= input.minimumGroupSize && group.summary.totalR < 0)
      .sort(worstFirst),
    winnerGroups: groupsFor(trades, badAttemptKey, costRPerTrade)
      .filter((group) => group.summary.trades >= input.minimumGroupSize && group.summary.totalR > 0)
      .sort(bestFirst),
    featureGroups: featureGroupsFor(trades, input.minimumGroupSize, costRPerTrade),
  };
}

function featureGroupsFor(
  trades: ReaderBadAttemptTrade[],
  minimumGroupSize: number,
  costRPerTrade: number,
): ReaderBadAttemptGroup[] {
  const keyed: Array<[string, (trade: ReaderBadAttemptTrade) => string]> = [
    ["side", (trade) => trade.side],
    ["first-reaction", (trade) => nullish(trade.diagnostics.firstReaction)],
    ["poc-rotation", (trade) => nullish(trade.diagnostics.pocRotation)],
    ["entry-timing", (trade) => nullish(trade.diagnostics.entryTiming)],
    ["vp-value", (trade) => nullish(trade.vp.value)],
    ["vp-poc", (trade) => nullish(trade.vp.poc)],
    ["regime", (trade) => nullish(trade.readerState.regime)],
    ["absorption-quality", (trade) => absorptionKey(trade)],
    ["initiative", (trade) => initiativeKey(trade)],
    ["orderflow", (trade) => `${nullish(trade.orderflow.pressure)}|${eventFamily(trade.orderflow.events)}`],
    ["label", (trade) => labelKey(trade)],
    ["narrative-verdict", (trade) => nullish(trade.narrative.verdict)],
  ];

  return keyed
    .flatMap(([prefix, keyFor]) => groupsFor(trades, (trade) => `${prefix}|${keyFor(trade)}`, costRPerTrade))
    .filter((group) => group.summary.trades >= minimumGroupSize)
    .sort(worstFirst);
}

function groupsFor(
  trades: ReaderBadAttemptTrade[],
  keyFor: (trade: ReaderBadAttemptTrade) => string,
  costRPerTrade: number,
): ReaderBadAttemptGroup[] {
  const groups = new Map<string, ReaderBadAttemptTrade[]>();
  for (const trade of trades) {
    const key = keyFor(trade);
    const existing = groups.get(key);
    if (existing) existing.push(trade);
    else groups.set(key, [trade]);
  }
  return [...groups.entries()].map(([key, groupTrades]) => ({
    key,
    summary: summarize(groupTrades, costRPerTrade),
    refs: groupTrades.slice(0, 12).map(refFor),
  }));
}

function badAttemptKey(trade: ReaderBadAttemptTrade): string {
  return [
    trade.side,
    trade.setupFamily ?? "no-setup-family",
    trade.narrative.key ?? "no-narrative",
    nullish(trade.readerState.regime),
    nullish(trade.readerState.auctionLocation),
    nullish(trade.readerState.auctionLevelKind),
    nullish(trade.readerState.auctionMode),
    nullish(trade.readerState.auctionPhase),
    nullish(trade.vp.auction),
    nullish(trade.vp.poc),
    nullish(trade.vp.value),
    nullish(trade.orderflow.pressure),
    eventFamily(trade.orderflow.events),
    initiativeKey(trade),
    absorptionKey(trade),
    nullish(trade.diagnostics.firstReaction),
    nullish(trade.diagnostics.pocRotation),
    nullish(trade.diagnostics.entryTiming),
    labelKey(trade),
  ].join("|");
}

function summarize(trades: ReaderBadAttemptTrade[], costRPerTrade: number): ReaderBadAttemptSummary {
  const rawRValues = trades.map((trade) => trade.result.r).filter((r): r is number => r !== null && Number.isFinite(r));
  const rValues = rawRValues.map((r) => r - costRPerTrade);
  const path = [...trades].sort((left, right) => Date.parse(left.entryAt) - Date.parse(right.entryAt));
  const chronological = equityPath(path.map((trade) => trade.result.r === null ? 0 : trade.result.r - costRPerTrade));
  const lossesFirst = equityPath([...rValues].sort((left, right) => left - right));
  const wins = rValues.filter((r) => r > 0).length;
  const losses = rValues.filter((r) => r < 0).length;
  const grossWinR = sum(rValues.filter((r) => r > 0));
  const grossLossR = sum(rValues.filter((r) => r < 0));
  const totalR = sum(rValues);
  return {
    trades: rValues.length,
    wins,
    losses,
    winRate: rValues.length === 0 ? 0 : round(wins / rValues.length),
    costRPerTrade: round(costRPerTrade),
    rawTotalR: round(sum(rawRValues)),
    grossWinR: round(grossWinR),
    grossLossR: round(grossLossR),
    profitFactor: grossLossR === 0 ? (grossWinR > 0 ? null : 0) : round(grossWinR / Math.abs(grossLossR)),
    totalR: round(totalR),
    averageR: rValues.length === 0 ? 0 : round(totalR / rValues.length),
    bestR: rValues.length === 0 ? null : round(Math.max(...rValues)),
    worstR: rValues.length === 0 ? null : round(Math.min(...rValues)),
    maxDrawdownR: chronological.maxDrawdownR,
    minEquityR: chronological.minEquityR,
    lossesFirstMaxDrawdownR: lossesFirst.maxDrawdownR,
    lossesFirstMinEquityR: lossesFirst.minEquityR,
    maxLossStreak: chronological.maxLossStreak,
  };
}

function equityPath(values: number[]): {
  maxDrawdownR: number;
  minEquityR: number;
  maxLossStreak: number;
} {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let minEquity = 0;
  let lossStreak = 0;
  let maxLossStreak = 0;
  for (const r of values) {
    equity += r;
    if (equity > peak) peak = equity;
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
    minEquity = Math.min(minEquity, equity);
    if (r < 0) {
      lossStreak += 1;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    } else {
      lossStreak = 0;
    }
  }
  return {
    maxDrawdownR: round(maxDrawdown),
    minEquityR: round(minEquity),
    maxLossStreak,
  };
}

function absorptionKey(trade: ReaderBadAttemptTrade): string {
  const quality = trade.absorptionQuality;
  if (!quality) return "no-absorption-quality";
  return [
    nullish(quality.quality),
    `side=${nullish(quality.side)}`,
    `absorbed=${nullish(quality.absorbedSide)}`,
    `toPoc=${nullish(quality.priceToPoc)}`,
    `targetTowardPoc=${quality.targetMovesTowardPoc ?? "unknown"}`,
  ].join("|");
}

function initiativeKey(trade: ReaderBadAttemptTrade): string {
  const initiative = trade.orderflow.initiative;
  if (!initiative) return "no-initiative-read";
  return [
    `side=${nullish(initiative.side)}`,
    `conviction=${nullish(initiative.conviction)}`,
  ].join("|");
}

function labelKey(trade: ReaderBadAttemptTrade): string {
  return trade.diagnostics.labels.length === 0 ? "no-label" : [...trade.diagnostics.labels].sort().join("+");
}

function eventFamily(events: string[]): string {
  return events.length === 0 ? "no-event" : [...events].sort().join("+");
}

function refFor(trade: ReaderBadAttemptTrade): string {
  return `${trade.asset}#${trade.index}@${trade.entryAt}`;
}

function worstFirst(left: ReaderBadAttemptGroup, right: ReaderBadAttemptGroup): number {
  return left.summary.totalR - right.summary.totalR || right.summary.trades - left.summary.trades;
}

function bestFirst(left: ReaderBadAttemptGroup, right: ReaderBadAttemptGroup): number {
  return right.summary.totalR - left.summary.totalR || right.summary.trades - left.summary.trades;
}

function nullish(value: string | null | undefined): string {
  return value ?? "unknown";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}



