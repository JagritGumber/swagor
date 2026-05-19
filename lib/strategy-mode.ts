export type StrategyMode = "scalper" | "swing";

const SCALPER_WORDS = [
  "scalp",
  "scalper",
  "intraday",
  "short-term",
  "short term",
  "quick trade",
  "quick trades",
  "range trade",
  "range trading",
];

export function detectStrategyMode(strategyText: string | null | undefined): StrategyMode {
  const text = (strategyText ?? "").toLowerCase();
  return SCALPER_WORDS.some((word) => text.includes(word)) ? "scalper" : "swing";
}
