const BASE_URL = "https://yields.llama.fi";

export type DefiLlamaPool = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  exposure: string;
  underlyingTokens?: string[];
};

/** USDC-denominated pools on our target protocols. */
const TARGET_PROJECTS = new Set<string>([
  "aave-v3",
  "compound-v3",
  "makerdao",
  "sky-lending", // sUSDS / DSR via Sky
  "pendle",
]);

const TARGET_CHAINS = new Set<string>(["Ethereum", "Arbitrum", "Base"]);

// In-memory cache. DefiLlama /pools returns ~18MB which Next.js fetch cache
// refuses (2MB ceiling). Re-fetching every cycle wastes 18MB over the wire.
// Module-level cache survives across requests in long-lived Node processes.
let cached: { at: number; pools: DefiLlamaPool[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

/**
 * Fetch yield pools from DefiLlama, filtered to our target protocols + chains.
 * Symbol filtering is applied per-call so the cache stays symbol-agnostic.
 */
export async function fetchYieldPools(opts?: {
  symbol?: string;
}): Promise<DefiLlamaPool[]> {
  const symbol = (opts?.symbol ?? "USDC").toUpperCase();
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.pools.filter((p) =>
      p.symbol.toUpperCase().includes(symbol),
    );
  }
  const res = await fetch(`${BASE_URL}/pools`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`DefiLlama /pools failed: ${res.status}`);
  }
  const { data } = (await res.json()) as { data: DefiLlamaPool[] };
  const filtered = data.filter(
    (p) => TARGET_PROJECTS.has(p.project) && TARGET_CHAINS.has(p.chain),
  );
  cached = { at: Date.now(), pools: filtered };
  return filtered.filter((p) => p.symbol.toUpperCase().includes(symbol));
}
