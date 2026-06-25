export type ReaderEquityTrade = {
  r: number;
  entryAt?: number;
  exitAt?: number;
};

export type ReaderEquityOptions = {
  riskPct?: number;
  feePct?: number;
  slippagePct?: number;
  initialCapital?: number;
};

export type ReaderEquitySummary = {
  totalR: number;
  endingEquityR: number;
  peakEquityR: number;
  minEquityR: number;
  minEquityAt: string;
  maxDrawdownR: number;
  maxDrawdownFrom: string;
  maxDrawdownAt: string;
  returnPct: number;
  maxDrawdownPct: number;
  minEquityPct: number;
  capitalRequiredAtRiskPct: number | null;
  capitalMultipleNeededToNeverGoBelowStart: number;
};

export function summarizeReaderEquity(
  trades: ReaderEquityTrade[],
  options: ReaderEquityOptions = {},
): ReaderEquitySummary {
  const riskPct = options.riskPct ?? 0;
  const costPct = (options.feePct ?? 0) + (options.slippagePct ?? 0);
  const sorted = [...trades].sort((left, right) => timeFor(left) - timeFor(right));
  let equity = 0;
  let peak = 0;
  let peakAt = "start";
  let maxDrawdown = 0;
  let maxDrawdownAt = "never";
  let maxDrawdownFrom = "start";
  let minEquity = 0;
  let minEquityAt = "start";

  for (const trade of sorted) {
    equity += trade.r;
    const at = dateKey(timeFor(trade));
    if (equity > peak) {
      peak = equity;
      peakAt = at;
    }
    const drawdown = equity - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownAt = at;
      maxDrawdownFrom = peakAt;
    }
    if (equity < minEquity) {
      minEquity = equity;
      minEquityAt = at;
    }
  }

  const totalR = round(equity);
  const grossReturnPct = totalR * riskPct;
  const totalCostPct = sorted.length * costPct;
  const reservePct = Math.max(0, -minEquity * riskPct);
  const capitalMultiple = round(1 + reservePct / 100);
  const initialCapital = options.initialCapital;

  return {
    totalR,
    endingEquityR: totalR,
    peakEquityR: round(peak),
    minEquityR: round(minEquity),
    minEquityAt,
    maxDrawdownR: round(maxDrawdown),
    maxDrawdownFrom,
    maxDrawdownAt,
    returnPct: round(grossReturnPct - totalCostPct),
    maxDrawdownPct: round(maxDrawdown * riskPct),
    minEquityPct: round(minEquity * riskPct),
    capitalRequiredAtRiskPct: initialCapital === undefined ? null : round(initialCapital * capitalMultiple),
    capitalMultipleNeededToNeverGoBelowStart: capitalMultiple,
  };
}

function timeFor(trade: ReaderEquityTrade): number {
  return trade.exitAt ?? trade.entryAt ?? 0;
}

function dateKey(time: number): string {
  if (!Number.isFinite(time) || time <= 0) return "unknown";
  return new Date(time).toISOString().slice(0, 10);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}



