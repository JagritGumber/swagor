import "server-only";

import type { CycleWarning } from "./cycle-checks";

export type SymbolFeature = {
  symbol: string;
  openInterestDeltas?: { last1h?: number | null };
  timeframes?: { "1h"?: { emaTrend?: string; rsi14?: number | null } };
};

type SwarmRound = {
  personaId: string;
  reasoning: string;
  proposedAllocation: unknown;
};

const RISING_OI = /\brising\b.{0,15}\b(oi|open[- ]interest)\b|\bincreasing\b.{0,15}\b(oi|open[- ]interest)\b/i;
const FALLING_OI = /\bfalling\b.{0,15}\b(oi|open[- ]interest)\b|\bdecreasing\b.{0,15}\b(oi|open[- ]interest)\b/i;
const BULLISH_TREND = /\b(bullish|uptrend|trending up)\b/i;
const BEARISH_TREND = /\b(bearish|downtrend|trending down)\b/i;
const OI_THRESHOLD = 0.02; // 2% delta over 1h counts as a real move

/**
 * Scan persona oneLineReasons + reasoning text for claims that
 * contradict the marketFeatures the persona actually received. Cheap
 * regex match against the four most-cited features (OI direction, 1h
 * EMA trend). Misses semantic nuance; catches the blatant fabrications
 * where a persona says "rising OI" while the data shows a 3% drop.
 */
export function findHallucinations(input: {
  rounds: SwarmRound[];
  marketFeatures: { symbols?: SymbolFeature[] };
}): CycleWarning[] {
  const warnings: CycleWarning[] = [];
  const featureByAsset = new Map<string, SymbolFeature>();
  for (const s of input.marketFeatures.symbols ?? []) {
    if (s.symbol) featureByAsset.set(s.symbol.toUpperCase(), s);
  }

  for (const round of input.rounds) {
    const text = `${round.reasoning} ${JSON.stringify(round.proposedAllocation)}`;
    for (const [asset, feat] of featureByAsset) {
      if (!text.toUpperCase().includes(asset)) continue;
      const oi1h = feat.openInterestDeltas?.last1h;
      const emaTrend = feat.timeframes?.["1h"]?.emaTrend;

      if (RISING_OI.test(text) && typeof oi1h === "number" && oi1h <= OI_THRESHOLD) {
        warnings.push({
          severity: "warn",
          message: `${round.personaId} claimed rising OI on ${asset} but oi_delta_1h=${oi1h.toFixed(3)}`,
        });
      }
      if (FALLING_OI.test(text) && typeof oi1h === "number" && oi1h >= -OI_THRESHOLD) {
        warnings.push({
          severity: "warn",
          message: `${round.personaId} claimed falling OI on ${asset} but oi_delta_1h=${oi1h.toFixed(3)}`,
        });
      }
      if (BULLISH_TREND.test(text) && emaTrend === "bearish") {
        warnings.push({
          severity: "warn",
          message: `${round.personaId} called ${asset} bullish but 1h emaTrend=bearish`,
        });
      }
      if (BEARISH_TREND.test(text) && emaTrend === "bullish") {
        warnings.push({
          severity: "warn",
          message: `${round.personaId} called ${asset} bearish but 1h emaTrend=bullish`,
        });
      }
    }
  }

  return warnings;
}
