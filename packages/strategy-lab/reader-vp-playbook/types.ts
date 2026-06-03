import type { Side } from "../types";

export type ReaderVpPlaybookKind =
  | "no-trade"
  | "range-fade-to-poc"
  | "failed-breakout-fade-to-poc"
  | "accepted-continuation";

export type ReaderVpPlaybook = {
  kind: ReaderVpPlaybookKind;
  allowedSide: Side | "none";
  reason: string;
};
