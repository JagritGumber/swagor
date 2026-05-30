import type { AuctionRead } from "../read/types";
import type { OrderflowRead } from "../orderflow/types";
import type { ReaderMarketRegime } from "../market-regime/types";
import type { Side } from "../types";
import type { ReaderAuctionMode, ReaderAuctionModeState } from "./types";

export function readReaderAuctionMode(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  regime?: ReaderMarketRegime;
  state?: ReaderAuctionModeState | null;
}): ReaderAuctionMode {
  const state = input.state ?? null;
  const expansion = expansionDirection(input.auction.location);
  const failedExpansion = failedExpansionDirection(input.auction.location, state?.lastExpansionDirection ?? null);
  const returnedToPoc = input.auction.location === "near-poc" && isEdgeOrOutside(state?.previousLocation ?? null);
  const nextPocGravity = Boolean(state?.pocGravity) || returnedToPoc || failedExpansion !== null;
  const result = modeFor({ ...input, state, failedExpansion, pocGravity: nextPocGravity });

  updateState({ state, location: input.auction.location, pressure: input.orderflow.pressure, expansion, failedExpansion, pocGravity: nextPocGravity });
  return result;
}

function modeFor(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  regime?: ReaderMarketRegime;
  state: ReaderAuctionModeState | null;
  failedExpansion: Side | null;
  pocGravity: boolean;
}): ReaderAuctionMode {
  if (violentUnknown(input, input.state)) {
    return mode("violent-unknown", "violent-chop", "none", [
      "high-vol auction is rotating around POC with two-sided pressure",
    ]);
  }

  if (input.failedExpansion !== null) {
    return mode("failed-expansion", failedExpansionPhase(input.auction.location), opposite(input.failedExpansion), [
      `${input.failedExpansion} expansion failed back into value`,
    ]);
  }

  if (input.pocGravity && insideValue(input.auction.location)) {
    return mode("poc-gravity", "poc-gravity-rotation", "both", [
      "recent edge attempt returned to POC, so only POC-directed rotations are allowed",
    ]);
  }

  if (initiativeExpansion(input.auction.location, input.orderflow.pressure)) {
    return mode("initiative-expansion", "initiative-acceptance", expansionDirection(input.auction.location) ?? "both", [
      "auction is accepting outside value with initiative pressure",
    ]);
  }

  return mode("balanced-value", balancedPhase(input.auction.location), "both", [
    insideValue(input.auction.location)
      ? "auction is inside value"
      : "auction is waiting for value acceptance or rejection",
  ]);
}

function updateState(input: {
  state: ReaderAuctionModeState | null;
  location: AuctionRead["location"];
  pressure: OrderflowRead["pressure"];
  expansion: Side | null;
  failedExpansion: Side | null;
  pocGravity: boolean;
}): void {
  if (!input.state) return;
  input.state.pocGravity = input.pocGravity;
  input.state.failedExpansionDirection = input.failedExpansion ?? input.state.failedExpansionDirection;
  input.state.lastExpansionDirection = input.expansion ?? input.state.lastExpansionDirection;
  input.state.previousLocation = input.location;
  input.state.previousPressure = input.pressure;
}

function mode(
  mode: ReaderAuctionMode["mode"],
  phase: ReaderAuctionMode["phase"],
  allowedDirection: ReaderAuctionMode["allowedDirection"],
  reasons: string[],
): ReaderAuctionMode {
  return { mode, phase, allowedDirection, reasons };
}

function expansionDirection(location: AuctionRead["location"]): Side | null {
  if (location === "above-value") return "long";
  if (location === "below-value") return "short";
  return null;
}

function failedExpansionDirection(location: AuctionRead["location"], lastExpansionDirection: Side | null): Side | null {
  if (!lastExpansionDirection || !insideValue(location)) return null;
  return lastExpansionDirection;
}

function failedExpansionPhase(location: AuctionRead["location"]): ReaderAuctionMode["phase"] {
  return location === "value-low" || location === "value-high"
    ? "failed-expansion-fade"
    : "poc-gravity-rotation";
}

function balancedPhase(location: AuctionRead["location"]): ReaderAuctionMode["phase"] {
  return location === "value-low" || location === "value-high"
    ? "value-edge-rotation"
    : "balanced-wait";
}

function initiativeExpansion(location: AuctionRead["location"], pressure: OrderflowRead["pressure"]): boolean {
  return (location === "above-value" && pressure === "buy-pressure")
    || (location === "below-value" && pressure === "sell-pressure");
}

function insideValue(location: AuctionRead["location"]): boolean {
  return location === "near-poc" || location === "value-low" || location === "value-high";
}

function isEdgeOrOutside(location: AuctionRead["location"] | null): boolean {
  return location === "value-low"
    || location === "value-high"
    || location === "above-value"
    || location === "below-value"
    || location === "outside-profile";
}

function violentUnknown(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  regime?: ReaderMarketRegime;
}, state: ReaderAuctionModeState | null): boolean {
  if (!input.regime?.highVol || input.auction.location !== "near-poc") return false;
  if (!state?.previousPressure) return false;
  return state.previousPressure !== input.orderflow.pressure
    && state.previousPressure !== "balanced"
    && input.orderflow.pressure !== "balanced";
}

function opposite(side: Side): Side {
  return side === "long" ? "short" : "long";
}
