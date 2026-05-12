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
    beat: "Reads the venue. Pool depth, slippage, protocol health",
    bias: "Will block a trade if the destination cannot absorb it cleanly.",
  },
  {
    id: "skeptic",
    name: "The Skeptic",
    beat: "Reads the tail. Exits, depegs, hidden correlations",
    bias: "Will say no when nobody else wants to. Often right when right.",
  },
] as const;

export type AnalystId = (typeof ANALYSTS)[number]["id"];

export const SAMPLE_CYCLE = {
  id: "0x4f7c...a812",
  pair: "USDe / USDC",
  venue: "Pendle PT-eUSDe · 21d expiry",
  signal: "Higher yield window opened on Pendle's USDe PT market.",
  proposalPlain: "Rotate 60% of idle USDC into the 21-day USDe PT.",
  expectedPctPlain: "~4.8% on the leg",
  duration: "settled in 3h 14m",
  entry: 115,
  exit: 158,
  pnlUsd: "+$43.21",
  pnlPctPlain: "+37.4%",
  finalSize: "downsized to 35%",
  exitPolicy: "hard exit Wednesday close",
  arcTx: "0x09da...0818",
};

export const SAMPLE_ROUND_ONE = [
  {
    who: "economist",
    verdict: "approve_with_note",
    text: "CPI came in soft and the FOMC is leaning dovish. Risk-on tilt is fine for the week. I want a clear exit by Friday's PCE print though. The regime could flip on a hot number.",
  },
  {
    who: "analyst",
    verdict: "approve",
    text: "The Pendle pool has about $48M of depth and the 7-day numbers are stable. At 60% sizing the slippage comes in under 0.2%. The venue is fine for this trade.",
  },
  {
    who: "skeptic",
    verdict: "reject",
    text: "Ethena's USDe has lost 41% of its TVL over the last 30 days. That is redemption pressure, and the market is mispricing the concentration risk in their reserve mix. A wobble before this PT expires and the position is in real trouble.",
  },
] as const;

export const SAMPLE_ROUND_TWO = [
  {
    who: "economist",
    verdict: "approve_with_note",
    text: "The Skeptic's TVL point is real, but it reads as redemption pressure, not a break in the peg. I will downgrade my view to a soft approve and tighten the exit to Wednesday close.",
  },
  {
    who: "analyst",
    verdict: "approve",
    text: "Spot depth and 30-day TVL trend are independent on a 21-day horizon. The pool will absorb the rotation tomorrow whether or not Ethena's redemption queue grows. Maintaining approve.",
  },
  {
    who: "skeptic",
    verdict: "reject",
    text: "Spot depth does not matter if the underlying breaks its peg. The tail risk is the same one I flagged. Maintaining my reject. Preserve the dissent on-chain.",
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
  "Solon operates on Arc Testnet with simulated capital. Examples shown are hypothetical and illustrative of how a deliberation is structured. They are not records of real trades, predictions of future performance, or investment advice. You are responsible for your own decisions.";
