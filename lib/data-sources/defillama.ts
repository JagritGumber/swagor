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

/**
 * Fetch yield pools from DefiLlama, filtered to our target protocols + chains
 * and USDC-shaped assets. Cached for 5 minutes (Next.js revalidate).
 */
export async function fetchYieldPools(opts?: {
  symbol?: string;
}): Promise<DefiLlamaPool[]> {
  const res = await fetch(`${BASE_URL}/pools`, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`DefiLlama /pools failed: ${res.status}`);
  }
  const { data } = (await res.json()) as { data: DefiLlamaPool[] };
  const symbol = (opts?.symbol ?? "USDC").toUpperCase();
  return data.filter(
    (p) =>
      TARGET_PROJECTS.has(p.project) &&
      TARGET_CHAINS.has(p.chain) &&
      p.symbol.toUpperCase().includes(symbol)
  );
}
