import type { ReaderBadAttemptTrade } from "./profile-reader-bad-attempts";

export type ReaderFragilityTrade = {
  r: number;
  entryAt?: string | number;
};

export type ReaderFragilityOptions = {
  riskPct?: number;
  monteCarloRuns?: number;
  seed?: number;
};

export type ReaderFragilityPath = {
  totalR: number;
  maxDrawdownR: number;
  minEquityR: number;
  maxLossStreak: number;
};

export type ReaderFragilityQuantiles = {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  worst: number;
};

export type ReaderFragilitySummary = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  grossWinR: number;
  grossLossR: number;
  profitFactor: number | null;
  averageR: number;
  bestR: number | null;
  worstR: number | null;
  topWinR: number | null;
  topThreeWinR: number;
  topWinShareOfGrossWin: number | null;
  topWinShareOfTotal: number | null;
  chronological: ReaderFragilityPath;
  lossesFirst: ReaderFragilityPath;
  monteCarlo: {
    runs: number;
    maxDrawdownR: ReaderFragilityQuantiles;
    minEquityR: ReaderFragilityQuantiles;
    maxLossStreak: ReaderFragilityQuantiles;
  };
  risk: {
    riskPct: number;
    returnPct: number;
    chronologicalMaxDrawdownPct: number;
    lossesFirstMaxDrawdownPct: number;
    monteCarloP95MaxDrawdownPct: number;
    monteCarloWorstMaxDrawdownPct: number;
  };
};

const DEFAULT_MONTE_CARLO_RUNS = 2_000;
const DEFAULT_SEED = 13_371;

export function summarizeReaderFragility(
  trades: ReaderFragilityTrade[],
  options: ReaderFragilityOptions = {},
): ReaderFragilitySummary {
  const values = trades
    .map((trade) => trade.r)
    .filter((r) => Number.isFinite(r));
  const chronological = [...trades]
    .filter((trade) => Number.isFinite(trade.r))
    .sort((left, right) => timeFor(left) - timeFor(right))
    .map((trade) => trade.r);
  const lossesFirst = [...values].sort((left, right) => left - right);
  const monteCarloRuns = options.monteCarloRuns ?? DEFAULT_MONTE_CARLO_RUNS;
  const paths = shuffledPaths(values, monteCarloRuns, options.seed ?? DEFAULT_SEED);
  const wins = values.filter((r) => r > 0).length;
  const losses = values.filter((r) => r < 0).length;
  const winValues = values.filter((r) => r > 0).sort((left, right) => right - left);
  const grossWinR = sum(winValues);
  const grossLossR = sum(values.filter((r) => r < 0));
  const totalR = sum(values);
  const topWinR = winValues[0] ?? null;
  const topThreeWinR = sum(winValues.slice(0, 3));
  const riskPct = options.riskPct ?? 0;
  const maxDrawdowns = paths.map((path) => path.maxDrawdownR);
  const minEquities = paths.map((path) => path.minEquityR);
  const lossStreaks = paths.map((path) => path.maxLossStreak);

  return {
    trades: values.length,
    wins,
    losses,
    winRate: values.length === 0 ? 0 : round(wins / values.length),
    totalR: round(totalR),
    grossWinR: round(grossWinR),
    grossLossR: round(grossLossR),
    profitFactor: grossLossR === 0 ? (grossWinR > 0 ? null : 0) : round(grossWinR / Math.abs(grossLossR)),
    averageR: values.length === 0 ? 0 : round(totalR / values.length),
    bestR: values.length === 0 ? null : round(Math.max(...values)),
    worstR: values.length === 0 ? null : round(Math.min(...values)),
    topWinR: topWinR === null ? null : round(topWinR),
    topThreeWinR: round(topThreeWinR),
    topWinShareOfGrossWin: grossWinR > 0 && topWinR !== null ? round(topWinR / grossWinR) : null,
    topWinShareOfTotal: totalR > 0 && topWinR !== null ? round(topWinR / totalR) : null,
    chronological: pathFor(chronological),
    lossesFirst: pathFor(lossesFirst),
    monteCarlo: {
      runs: monteCarloRuns,
      maxDrawdownR: negativeQuantiles(maxDrawdowns),
      minEquityR: negativeQuantiles(minEquities),
      maxLossStreak: positiveQuantiles(lossStreaks),
    },
    risk: {
      riskPct,
      returnPct: round(totalR * riskPct),
      chronologicalMaxDrawdownPct: round(pathFor(chronological).maxDrawdownR * riskPct),
      lossesFirstMaxDrawdownPct: round(pathFor(lossesFirst).maxDrawdownR * riskPct),
      monteCarloP95MaxDrawdownPct: round(quantile(maxDrawdowns, 0.05) * riskPct),
      monteCarloWorstMaxDrawdownPct: round(Math.min(0, ...maxDrawdowns) * riskPct),
    },
  };
}

export function summarizeReaderTradeFragility(input: {
  trades: ReaderBadAttemptTrade[];
  options?: ReaderFragilityOptions;
}): ReaderFragilitySummary {
  return summarizeReaderFragility(input.trades
    .filter((trade) => trade.trust && trade.result.r !== null)
    .map((trade) => ({
      r: trade.result.r ?? 0,
      entryAt: trade.entryAt,
    })), input.options);
}

function shuffledPaths(values: number[], runs: number, seed: number): ReaderFragilityPath[] {
  if (values.length === 0 || runs <= 0) return [];
  const random = seededRandom(seed);
  const paths: ReaderFragilityPath[] = [];
  for (let run = 0; run < runs; run += 1) {
    paths.push(pathFor(shuffle(values, random)));
  }
  return paths;
}

function shuffle(values: number[], random: () => number): number[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function pathFor(values: number[]): ReaderFragilityPath {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let minEquity = 0;
  let lossStreak = 0;
  let maxLossStreak = 0;

  for (const r of values) {
    equity += r;
    peak = Math.max(peak, equity);
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
    totalR: round(equity),
    maxDrawdownR: round(maxDrawdown),
    minEquityR: round(minEquity),
    maxLossStreak,
  };
}

function negativeQuantiles(values: number[]): ReaderFragilityQuantiles {
  return {
    p50: round(quantile(values, 0.5)),
    p75: round(quantile(values, 0.25)),
    p90: round(quantile(values, 0.1)),
    p95: round(quantile(values, 0.05)),
    p99: round(quantile(values, 0.01)),
    worst: round(Math.min(0, ...values)),
  };
}

function positiveQuantiles(values: number[]): ReaderFragilityQuantiles {
  return {
    p50: round(quantile(values, 0.5)),
    p75: round(quantile(values, 0.75)),
    p90: round(quantile(values, 0.9)),
    p95: round(quantile(values, 0.95)),
    p99: round(quantile(values, 0.99)),
    worst: round(Math.max(0, ...values)),
  };
}

function quantile(values: number[], probability: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function timeFor(trade: ReaderFragilityTrade): number {
  if (typeof trade.entryAt === "number") return trade.entryAt;
  if (typeof trade.entryAt === "string") return Date.parse(trade.entryAt);
  return 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
