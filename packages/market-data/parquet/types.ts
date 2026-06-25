export type MarketStoreVenue = "bybit";
export type MarketStoreMarket = "trading";

export type OrderflowBucket = {
  bucketMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  largestTradeSize: number;
  largestTradePrice: number;
  largestTradeSide: "buy" | "sell";
  lastTradePrice: number;
};

export type VolumeProfileBucket = {
  startMs: number;
  endMs: number;
  binLow: number;
  binHigh: number;
  binMid: number;
  volume: number;
};

export type MarketStoreMonthFile = {
  path: string;
  startMs: number;
  endMs: number;
  rowCount: number;
  schemaVersion: number;
};

export type MarketStoreMonthManifest = {
  buckets1s?: MarketStoreMonthFile;
  profiles5m?: MarketStoreMonthFile;
  sourceRawDates: string[];
  createdAt: string;
};

export type MarketStoreManifest = {
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
  schemaVersion: number;
  months: Record<string, MarketStoreMonthManifest>;
};

