import { profileReaderBadAttempts, type ReaderBadAttemptSummary, type ReaderBadAttemptTrade } from "./profile-reader-bad-attempts";

export type ReaderAttemptHypothesis = {
  key: string;
  description: string;
  keep: (trade: ReaderBadAttemptTrade) => boolean;
};

export type ReaderAttemptHypothesisResult = {
  key: string;
  description: string;
  kept: ReaderBadAttemptSummary;
  removed: ReaderBadAttemptSummary;
};

export type ReaderAttemptHypothesisReport = {
  baseline: ReaderBadAttemptSummary;
  results: ReaderAttemptHypothesisResult[];
};

export function compareReaderAttemptHypotheses(input: {
  trades: ReaderBadAttemptTrade[];
  hypotheses?: ReaderAttemptHypothesis[];
}): ReaderAttemptHypothesisReport {
  const trades = input.trades.filter((trade) => trade.trust && trade.result.r !== null);
  const hypotheses = input.hypotheses ?? defaultReaderAttemptHypotheses();
  return {
    baseline: summarize(trades),
    results: hypotheses.map((hypothesis) => {
      const kept = trades.filter(hypothesis.keep);
      const removed = trades.filter((trade) => !hypothesis.keep(trade));
      return {
        key: hypothesis.key,
        description: hypothesis.description,
        kept: summarize(kept),
        removed: summarize(removed),
      };
    }).sort(riskAwareHypothesisFirst),
  };
}

export function defaultReaderAttemptHypotheses(): ReaderAttemptHypothesis[] {
  return [
    {
      key: "long-only",
      description: "Keep only long continuation-pullback attempts.",
      keep: (trade) => trade.side === "long",
    },
    {
      key: "long-radar-favorable",
      description: "Keep long attempts only when the next reader-priced reaction is favorable.",
      keep: (trade) => trade.side === "long" && trade.diagnostics.firstReaction === "favorable-first-read",
    },
    {
      key: "long-absorption-or-clean-reaction",
      description: "Keep long attempts with pullback absorption evidence or a clean favorable continuation reaction.",
      keep: (trade) => trade.side === "long" && (hasLongPullbackAbsorption(trade) || isCleanLongContinuation(trade)),
    },
    {
      key: "long-narrative-not-invalidated",
      description: "Keep long attempts unless the post-entry narrative audit says the thesis was invalidated or wrong.",
      keep: (trade) => trade.side === "long" && trade.narrative.verdict !== "invalidated" && trade.narrative.verdict !== "wrong",
    },
    {
      key: "long-narrative-confirmed",
      description: "Keep long attempts only when the narrative audit stayed confirmed or weak-confirmed.",
      keep: (trade) => trade.side === "long" && (trade.narrative.verdict === "confirmed" || trade.narrative.verdict === "weak-confirmed"),
    },
    {
      key: "long-overwhelming-initiative",
      description: "Keep long attempts only when the current orderflow reader marks buy initiative as overwhelming.",
      keep: (trade) => trade.side === "long" && hasInitiativeConviction(trade, "buy", "overwhelming"),
    },
    {
      key: "long-decisive-or-overwhelming-initiative",
      description: "Keep long attempts when the current orderflow reader marks buy initiative as decisive or overwhelming.",
      keep: (trade) => trade.side === "long" && (
        hasInitiativeConviction(trade, "buy", "decisive")
        || hasInitiativeConviction(trade, "buy", "overwhelming")
      ),
    },
    {
      key: "long-no-mixed-initiative",
      description: "Keep long attempts unless the current orderflow reader marks buy initiative as mixed/weak.",
      keep: (trade) => trade.side === "long" && !hasInitiativeConviction(trade, "buy", "mixed"),
    },
    {
      key: "long-absorption",
      description: "Keep long attempts only when orderflow shows pullback absorption/trap evidence.",
      keep: (trade) => trade.side === "long" && hasLongPullbackAbsorption(trade),
    },
    {
      key: "long-range-or-high-vol",
      description: "Keep long attempts only when the regime reader says range or high-vol.",
      keep: (trade) => trade.side === "long" && (trade.readerState.regime === "range" || trade.readerState.regime === "high-vol"),
    },
    {
      key: "long-not-range",
      description: "Keep long attempts only when the regime reader is not classifying the market as range.",
      keep: (trade) => trade.side === "long" && trade.readerState.regime !== "range",
    },
    {
      key: "long-no-size-down-label",
      description: "Keep long attempts unless the later dossier says it needed faster size-down.",
      keep: (trade) => trade.side === "long" && !trade.diagnostics.labels.includes("needs-selbo-size-down"),
    },
    {
      key: "long-no-flat-or-adverse",
      description: "Keep long attempts only when the next reader-priced reaction is not flat/adverse.",
      keep: (trade) => trade.side === "long" && trade.diagnostics.firstReaction === "favorable-first-read",
    },
    {
      key: "long-expansion-needs-absorption",
      description: "Keep long attempts, but require absorption evidence during high-vol upward value expansion.",
      keep: (trade) => {
        if (trade.side !== "long") return false;
        const expansion = trade.readerState.regime === "high-vol" && trade.vp.value === "value-expanding-up";
        return !expansion || hasLongPullbackAbsorption(trade);
      },
    },
  ];
}

function hasLongPullbackAbsorption(trade: ReaderBadAttemptTrade): boolean {
  const events = new Set(trade.orderflow.events);
  return events.has("confirmed-absorption")
    || events.has("buy-absorption")
    || events.has("stalled-buying")
    || trade.absorptionQuality?.quality === "churn";
}

function isCleanLongContinuation(trade: ReaderBadAttemptTrade): boolean {
  return trade.diagnostics.firstReaction === "favorable-first-read"
    && trade.diagnostics.pocRotation === "moved-toward-poc";
}

function hasInitiativeConviction(trade: ReaderBadAttemptTrade, side: string, conviction: string): boolean {
  return trade.orderflow.initiative?.side === side
    && trade.orderflow.initiative?.conviction === conviction;
}

function summarize(trades: ReaderBadAttemptTrade[]): ReaderBadAttemptSummary {
  return profileReaderBadAttempts({ trades, minimumGroupSize: 1 }).summary;
}

function riskAwareHypothesisFirst(
  left: ReaderAttemptHypothesisResult,
  right: ReaderAttemptHypothesisResult,
): number {
  return positiveTotalFirst(left, right)
    || profitFactorFirst(left, right)
    || lessDrawdownFirst(left, right)
    || fewerLossesFirst(left, right)
    || right.kept.totalR - left.kept.totalR
    || right.kept.winRate - left.kept.winRate
    || right.kept.trades - left.kept.trades;
}

function positiveTotalFirst(
  left: ReaderAttemptHypothesisResult,
  right: ReaderAttemptHypothesisResult,
): number {
  return Number(right.kept.totalR > 0) - Number(left.kept.totalR > 0);
}

function profitFactorFirst(
  left: ReaderAttemptHypothesisResult,
  right: ReaderAttemptHypothesisResult,
): number {
  return profitFactorFor(right) - profitFactorFor(left);
}

function profitFactorFor(result: ReaderAttemptHypothesisResult): number {
  if (result.kept.trades === 0) return 0;
  return result.kept.profitFactor ?? Number.POSITIVE_INFINITY;
}

function lessDrawdownFirst(
  left: ReaderAttemptHypothesisResult,
  right: ReaderAttemptHypothesisResult,
): number {
  return right.kept.lossesFirstMaxDrawdownR - left.kept.lossesFirstMaxDrawdownR
    || right.kept.maxDrawdownR - left.kept.maxDrawdownR;
}

function fewerLossesFirst(
  left: ReaderAttemptHypothesisResult,
  right: ReaderAttemptHypothesisResult,
): number {
  return left.kept.losses - right.kept.losses;
}
