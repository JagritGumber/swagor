/**
 * Shared marketing copy. Single source so analyst names, sample
 * deliberation text, and legal disclosures stay consistent everywhere.
 * No em-dashes. Plain English.
 */

export const ANALYSTS = [
  {
    id: "economist",
    name: "The Economist",
    beat: "Reads the macro tape. Central banks, prints, regime",
    bias: "Will fade a trade if the broader market is moving against it.",
  },
  {
    id: "analyst",
    name: "The Analyst",
    beat: "Reads the venue. Funding, open interest, mark-price liquidity",
    bias: "Will block a trade if the venue cannot absorb it cleanly.",
  },
  {
    id: "skeptic",
    name: "The Skeptic",
    beat: "Reads the tail. Liquidation cascades, hidden correlations, gap risk",
    bias: "Will say no when nobody else wants to. Often right when right.",
  },
] as const;

export type AnalystId = (typeof ANALYSTS)[number]["id"];

export const SAMPLE_CYCLE = {
  id: "0x4f7c...a812",
  pair: "ETH-USD perp",
  venue: "Hyperliquid testnet · 3x leverage long",
  signal: "Hourly funding flipped negative as ETH reclaimed a 30-day key level.",
  proposalPlain: "Open a 3x ETH long with $400 collateral.",
  expectedPctPlain: "~5% on the leg",
  duration: "settled in 14h 22m",
  entry: 3214,
  exit: 3382,
  pnlUsd: "+$67.50",
  pnlPctPlain: "+16.9%",
  finalSize: "sized to $280 collateral",
  exitPolicy: "hard exit on Friday CPI print",
  arcTx: "0x09da...0818",
};

export const SAMPLE_ROUND_ONE = [
  {
    who: "economist",
    verdict: "approve_with_note",
    text: "BTC dominance is breaking and the ETH ratio is reclaiming a 30-day key level. Macro tilt is risk-on for the week. I want a hard exit by Friday's CPI print though, the regime can flip on a hot number.",
  },
  {
    who: "analyst",
    verdict: "approve",
    text: "Hourly funding flipped negative four hours ago, open interest is stable, and mark-price liquidity is clean for the proposed size. The venue is fine for this trade.",
  },
  {
    who: "skeptic",
    verdict: "reject",
    text: "Funding flipping negative right before a CPI print is a setup, not a signal. If the print runs hawkish and leverage washes, this position liquidates before the macro view has time to be right.",
  },
] as const;

export const SAMPLE_ROUND_TWO = [
  {
    who: "economist",
    verdict: "approve_with_note",
    text: "The Skeptic's CPI concern is real but it is partly priced. I will soft-approve and tighten the exit to the print itself rather than Friday close.",
  },
  {
    who: "analyst",
    verdict: "approve",
    text: "At 3x with $400 collateral the liquidation buffer is over $400 down on ETH. A clean CPI gap to that level is improbable. Maintaining approve.",
  },
  {
    who: "skeptic",
    verdict: "reject",
    text: "Liquidation math does not matter if the underlying gaps through the wick. The tail risk is the same one I flagged. Maintaining my reject. Preserve the dissent on-chain.",
  },
] as const;

export const VERDICT_LABEL: Record<string, string> = {
  approve: "approved",
  approve_with_note: "approved with notes",
  reject: "rejected",
};

export const VERDICT_GLYPH: Record<string, string> = {
  approve: "✓",
  approve_with_note: "!",
  reject: "✗",
};

export const LEGAL_DISCLOSURE_SHORT =
  "Hypothetical example. Past performance is not indicative of future results.";

export const LEGAL_DISCLOSURE_LONG =
  "Selbo operates on Arc Testnet with simulated capital. Examples shown are hypothetical and illustrative of how a deliberation is structured. They are not records of real trades, predictions of future performance, or investment advice. You are responsible for your own decisions.";
