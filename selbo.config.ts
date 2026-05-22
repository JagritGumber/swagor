/**
 * Selbo coin universe - COMMITTED config (not an env var). This is the file an
 * operator running the open-source repo edits to choose which Hyperliquid
 * perps Selbo watches. No secrets here, so it lives in git.
 *
 * mode:
 *   "all"     - watch every perp Hyperliquid lists (capped by `maxCoins`).
 *   "include" - watch ONLY the coins in `include`.
 *   "exclude" - watch every listed perp EXCEPT those in `exclude`.
 *
 * maxCoins: hard ceiling on how many coins are actually watched per tick. Each
 * watched coin costs candle fetches + a slice of the agent's prompt every tick,
 * so "all" without a cap (~150 perps) is slow and expensive. Raise it (or set
 * it to a large number) deliberately. Symbols are matched case-insensitively.
 */
export type CoinUniverseConfig = {
  mode: "all" | "include" | "exclude";
  include: string[];
  exclude: string[];
  maxCoins: number;
};

export const coinUniverse: CoinUniverseConfig = {
  mode: "all",
  include: ["BTC", "ETH", "SOL"],
  exclude: [],
  maxCoins: 12,
};

/**
 * Resolve the active watchlist from this config against the live Hyperliquid
 * perp list (`allCoins`). `fallback` is used when the live list is unavailable
 * (e.g. a metadata fetch failed) so the agent always has something to watch.
 */
export function resolveCoinUniverse(allCoins: string[], fallback: string[] = ["BTC", "ETH", "SOL"]): string[] {
  const up = (xs: string[]) => xs.map((c) => c.toUpperCase());
  const all = up(allCoins);

  if (coinUniverse.mode === "include") {
    return up(coinUniverse.include).slice(0, coinUniverse.maxCoins);
  }
  if (all.length === 0) return up(fallback).slice(0, coinUniverse.maxCoins);
  if (coinUniverse.mode === "exclude") {
    const ex = new Set(up(coinUniverse.exclude));
    return all.filter((c) => !ex.has(c)).slice(0, coinUniverse.maxCoins);
  }
  return all.slice(0, coinUniverse.maxCoins);
}
