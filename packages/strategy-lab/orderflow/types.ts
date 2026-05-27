export type OrderflowSide = "buy" | "sell";

export type OrderflowTrade = {
  asset: string;
  side: OrderflowSide;
  price: number;
  size: number;
  time: number;
  id: string;
};

export type OrderflowBbo = {
  asset: string;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  time: number;
};

export type OrderflowEvent =
  | { type: "trade"; receivedAt: number; trade: OrderflowTrade }
  | { type: "bbo"; receivedAt: number; bbo: OrderflowBbo };

export type OrderflowWindow = {
  windowMs: number;
  trades: OrderflowTrade[];
  startIndex: number;
  bbo: OrderflowBbo | null;
};

export type OrderflowPressure = "buy-pressure" | "sell-pressure" | "balanced";

export type OrderflowRead = {
  asset: string;
  windowSeconds: number;
  lastPrice: number | null;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  averageTradeSize: number;
  largestTrade: OrderflowTrade | null;
  dominantSide: OrderflowSide | "none";
  pressure: OrderflowPressure;
  events: string[];
  narrative: string;
};
