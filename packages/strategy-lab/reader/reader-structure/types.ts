import type { VolumeProfileStructure, VolumeNode } from "@strategy-lab/read-core/read/parse-volume-profile-structure";
import type { CvdRead } from "@strategy-lab/read-core/orderflow/calculate-cvd";

export type MarketStructureLocation =
  | "at-hvn"
  | "at-lvn"
  | "at-poc"
  | "above-value"
  | "below-value"
  | "inside-value"
  | "unknown";

export type MarketStructureAction =
  | "accepting"
  | "rejecting"
  | "discovering"
  | "rotating"
  | "unknown";

export type MarketStructureRead = {
  asset: string;
  timestampMs: number;
  structure: VolumeProfileStructure | null;
  cvd: CvdRead | null;
  location: MarketStructureLocation;
  action: MarketStructureAction;
  nearestNode: VolumeNode | null;
  absorption: boolean;
  narrative: string;
};
