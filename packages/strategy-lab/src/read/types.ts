export type PriceLevel = {
  price: number;
  kind: "support" | "resistance";
  touches: number;
  lastTouchedAt: number;
  firstTouchedAt: number;
};

export type VolumeBin = {
  low: number;
  high: number;
  mid: number;
  volume: number;
};

export type LocalVolumeProfile = {
  low: number;
  high: number;
  binSize: number;
  poc: number;
  valueAreaLow: number;
  valueAreaHigh: number;
  bins: VolumeBin[];
};

export type AuctionLocation =
  | "below-value"
  | "value-low"
  | "near-poc"
  | "value-high"
  | "above-value"
  | "outside-profile";

export type AuctionRead = {
  asset: string;
  interval: string;
  level: PriceLevel | null;
  profile: LocalVolumeProfile | null;
  location: AuctionLocation;
  bias: "long" | "short" | "wait";
  narrative: string;
  invalidation: string | null;
  target: string | null;
};
