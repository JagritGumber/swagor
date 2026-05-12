const BASE_URL = "https://api.coingecko.com/api/v3";

export type PriceMap = Record<string, { usd: number; usd_24h_change?: number }>;

/**
 * Fetch spot USD prices for a list of CoinGecko IDs. Free tier, no key.
 * Cached for 60 seconds via Next.js revalidate.
 */
export async function fetchPrices(
  ids: string[] = ["bitcoin", "ethereum", "usd-coin"]
): Promise<PriceMap> {
  const params = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: "usd",
    include_24hr_change: "true",
  });
  const res = await fetch(`${BASE_URL}/simple/price?${params}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko /simple/price failed: ${res.status}`);
  }
  return res.json();
}
