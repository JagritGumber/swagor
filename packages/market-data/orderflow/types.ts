import type { OrderflowEvent } from "../../strategy-lab";
import type { HyperliquidNetwork } from "../shared/types";

export type HyperliquidWsTrade = {
  coin: string;
  side: string;
  px: string;
  sz: string;
  hash: string;
  time: number;
  tid: number;
  users: [string, string];
};

export type HyperliquidWsLevel = {
  px: string;
  sz: string;
  n: number;
};

export type HyperliquidWsBbo = {
  coin: string;
  time: number;
  bbo: [HyperliquidWsLevel | null, HyperliquidWsLevel | null];
};

export type StoredOrderflowEvent = {
  venue: "hyperliquid";
  network: HyperliquidNetwork;
  asset: string;
  receivedAt: number;
  channel: "trades" | "bbo";
  raw: unknown;
  events: OrderflowEvent[];
};

