import { maxDrawdown } from "../../backtest/backtest/max-drawdown";
import type { ReaderResultOutcome } from "../reader-result/types";
import type { ReaderReplaySummary } from "./types";

export function summarizeReaderOutcomes(input: {
  totalReads: number;
  totalEntries: number;
  entriesOpened?: number;
  outcomes: ReaderResultOutcome[];
}): ReaderReplaySummary {
  const equityCurve = [0];
  let totalR = 0;
  let wins = 0;
  let losses = 0;

  for (const outcome of input.outcomes) {
    totalR += outcome.r;
    if (outcome.r > 0) wins++;
    if (outcome.r < 0) losses++;
    equityCurve.push(totalR);
  }

  const totalOutcomes = input.outcomes.length;
  return {
    totalReads: input.totalReads,
    totalEntries: input.totalEntries,
    entriesOpened: input.entriesOpened ?? input.totalEntries,
    totalOutcomes,
    wins,
    losses,
    winRate: totalOutcomes === 0 ? 0 : wins / totalOutcomes,
    totalR: Number(totalR.toFixed(4)),
    averageR: totalOutcomes === 0 ? 0 : Number((totalR / totalOutcomes).toFixed(4)),
    maxDrawdownR: Number(maxDrawdown(equityCurve).toFixed(4)),
  };
}



