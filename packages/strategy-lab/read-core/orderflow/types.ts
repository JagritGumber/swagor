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
  bboHistory: OrderflowBbo[];
  bboStartIndex: number;
};

export type OrderflowPressure = "buy-pressure" | "sell-pressure" | "balanced";

export type OrderflowEvidenceTier = "none" | "aggressive" | "confirmed";

export type OrderflowEvidence = {
  pressure: OrderflowEvidenceTier;
  absorption: OrderflowEvidenceTier;
  print: "none" | "local-standout";
  followThrough: "holding" | "stalled" | "unknown";
};

export type OrderflowInitiativeConviction =
  | "none"
  | "mixed"
  | "decisive"
  | "overwhelming";

export type OrderflowInitiative = {
  side: OrderflowSide | "none";
  conviction: OrderflowInitiativeConviction;
  reasons: string[];
};

export type OrderflowTapeContext = {
  buyShare: number;
  sellShare: number;
  deltaShare: number;
  dominantShare: number;
  largestTradeShare: number | null;
  medianTradeSize: number | null;
  largestTradeRank: number | null;
  lastTradeRank: number | null;
  priceChange: number | null;
};

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
  evidence?: OrderflowEvidence;
  initiative?: OrderflowInitiative;
  tape?: OrderflowTapeContext;
  events: string[];
  narrative: string;
};

