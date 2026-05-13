/**
 * Hyperliquid testnet info-endpoint reads. POST-only JSON-RPC-style API.
 * Numbers are returned as strings (decimal precision); parse with Number()
 * at the edge of consumption to avoid float-drift through aggregation.
 * Rate limit: 1200 weight/min per IP (allMids/l2Book/clearinghouseState = 2,
 * candleSnapshot heavier).
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

const HL = "https://api.hyperliquid-testnet.xyz/info";

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(HL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 10 },
  });
  if (!res.ok) throw new Error(`HL ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Mid prices for every perp, keyed by coin symbol. Decimal strings. */
export type MidsMap = Record<string, string>;
export function fetchAllMids(): Promise<MidsMap> {
  return post<MidsMap>({ type: "allMids" });
}

/** Per-coin context: mark/oracle/funding/openInterest/dayVlm, etc. */
export type PerpAssetCtx = {
  markPx: string;
  oraclePx: string;
  midPx: string;
  premium: string;
  funding: string; // hourly rate, decimal string
  openInterest: string;
  dayNtlVlm: string;
  prevDayPx: string;
};
export type PerpUniverseEntry = { name: string; szDecimals: number; maxLeverage: number };
export type MetaAndCtxs = [{ universe: PerpUniverseEntry[] }, PerpAssetCtx[]];
export async function fetchMetaAndCtxs(): Promise<{ universe: PerpUniverseEntry[]; ctxs: PerpAssetCtx[] }> {
  const [meta, ctxs] = await post<MetaAndCtxs>({ type: "metaAndAssetCtxs" });
  return { universe: meta.universe, ctxs };
}

/** Open positions, equity, margin for an address. */
export type HLPosition = {
  position: {
    coin: string;
    szi: string; // signed size: positive = long, negative = short
    entryPx: string;
    leverage: { type: "isolated" | "cross"; value: number; rawUsd?: string };
    liquidationPx: string | null;
    marginUsed: string;
    maxLeverage: number;
    positionValue: string;
    returnOnEquity: string;
    unrealizedPnl: string;
    cumFunding: { allTime: string; sinceChange: string; sinceOpen: string };
  };
  type: "oneWay";
};
export type ClearinghouseState = {
  assetPositions: HLPosition[];
  marginSummary: { accountValue: string; totalMarginUsed: string; totalNtlPos: string; totalRawUsd: string };
  crossMarginSummary: { accountValue: string; totalMarginUsed: string; totalNtlPos: string; totalRawUsd: string };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  time: number;
};
export function fetchClearinghouse(address: string): Promise<ClearinghouseState> {
  return post<ClearinghouseState>({ type: "clearinghouseState", user: address.toLowerCase() });
}

/** OHLCV candles. Interval examples: 1m, 5m, 15m, 1h, 4h, 1d. */
export type Candle = {
  t: number; T: number; s: string; i: string;
  o: string; c: string; h: string; l: string;
  v: string; n: number;
};
export function fetchCandles(coin: string, interval: string, startMs: number, endMs: number): Promise<Candle[]> {
  return post<Candle[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime: startMs, endTime: endMs },
  });
}

/** L2 order book. `levels[0]` is bids, `levels[1]` is asks. */
export type BookLevel = { px: string; sz: string; n: number };
export type L2Book = { coin: string; time: number; levels: [BookLevel[], BookLevel[]] };
export function fetchL2Book(coin: string): Promise<L2Book> {
  return post<L2Book>({ type: "l2Book", coin });
}
