/**
 * Lightweight lexicon-based sentiment classifier for news headlines.
 * Cheap word match, no LLM call. Used to give the swarm + dev panel a
 * "12 positive / 4 negative / 6 neutral" breakdown so an admin can
 * tell at a glance whether the cycle ran during a fearful or euphoric
 * news cycle. Not accurate enough to drive trading decisions on its
 * own; useful as a calibration check on persona outputs.
 */
export type SentimentLabel = "positive" | "negative" | "neutral";
export type SentimentCounts = { positive: number; negative: number; neutral: number; total: number };

const POSITIVE = new Set([
  "bullish", "rally", "rallies", "surge", "surges", "soar", "soars",
  "breakout", "gain", "gains", "rise", "rises", "rising", "jump",
  "jumps", "climb", "climbs", "upgrade", "beat", "beats", "strong",
  "momentum", "hike", "pump", "pumps", "all-time", "ath", "buy",
  "accumulate", "boom", "boost",
]);

const NEGATIVE = new Set([
  "bearish", "crash", "crashes", "drop", "drops", "plunge", "plunges",
  "dump", "dumps", "sell-off", "selloff", "decline", "declines", "fall",
  "falls", "falling", "weak", "miss", "misses", "downgrade",
  "liquidation", "liquidations", "bust", "fear", "panic", "selloff",
  "rugpull", "rug", "hack", "hacks", "exploit", "exploits", "scam",
  "ban", "lawsuit", "sec", "fraud",
]);

function classifyTitle(title: string): SentimentLabel {
  const words = title.toLowerCase().split(/\W+/);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) pos++;
    if (NEGATIVE.has(w)) neg++;
  }
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export function classifyNews(items: Array<{ title: string }>): SentimentCounts {
  const counts: SentimentCounts = { positive: 0, negative: 0, neutral: 0, total: items.length };
  for (const item of items) {
    counts[classifyTitle(item.title)]++;
  }
  return counts;
}

export function classifyOne(title: string): SentimentLabel {
  return classifyTitle(title);
}
