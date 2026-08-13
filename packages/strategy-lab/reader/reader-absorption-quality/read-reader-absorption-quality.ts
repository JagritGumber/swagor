import type { OrderflowRead } from "@strategy-lab/read-core/orderflow/types";
import type { AuctionRead } from "@strategy-lab/read-core/read/types";
import type { ReaderAuctionMode } from "../reader-auction-mode/types";
import type { ReaderVpState } from "../reader-vp-state/types";
import type { Side } from "@strategy-lab/types";
import type { ReaderAbsorptionPolicy, ReaderAbsorptionQuality } from "./types";

export function readReaderAbsorptionQuality(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  auctionMode?: ReaderAuctionMode;
  vpState?: ReaderVpState;
}): ReaderAbsorptionQuality {
  const side = reversalSideFor(input);
  const absorbedSide = side === "long" ? "sell" : side === "short" ? "buy" : "none";
  const base = qualityBase(input, side, absorbedSide);

  if (side === "none") {
    return {
      ...base,
      quality: input.orderflow.events.includes("buy-absorption") || input.orderflow.events.includes("sell-absorption")
        ? "churn"
        : "unknown",
      reasons: input.orderflow.events.includes("buy-absorption") || input.orderflow.events.includes("sell-absorption")
        ? ["absorption is present away from a usable value edge"]
        : ["no absorption event is present"],
    };
  }

  if (isChurn(input)) {
    return { ...base, quality: "churn", reasons: ["absorption is happening inside POC/fair-value churn"] };
  }

  if (vpMigratesAgainstFade(input, side)) {
    return { ...base, quality: "continuation-risk", reasons: ["VP is migrating with the attacking side instead of trapping it"] };
  }

  const trappedSide = absorbedSide;
  if (trappedSide === "none") {
    return { ...base, quality: "unknown", reasons: ["absorption side is not readable"] };
  }

  const blockers = trapBlockers(input, side, trappedSide);
  if (blockers.length === 0) {
    return {
      ...base,
      quality: "trap-confirmed",
      reasons: ["absorbed initiative print stalled at the value edge and the target path rotates toward POC"],
    };
  }

  return { ...base, quality: "no-rotation", reasons: blockers };
}

function qualityBase(
  input: {
    auction: AuctionRead;
    orderflow: OrderflowRead;
    auctionMode?: ReaderAuctionMode;
    vpState?: ReaderVpState;
  },
  side: Side | "none",
  absorbedSide: "buy" | "sell" | "none",
): Omit<ReaderAbsorptionQuality, "quality" | "reasons"> {
  return {
    side,
    absorbedSide,
    auctionLocation: input.auction.location,
    auctionMode: input.auctionMode?.mode ?? "unknown",
    auctionPhase: input.auctionMode?.phase ?? "unknown",
    vpAuction: input.vpState?.auction ?? "unknown",
    vpPoc: input.vpState?.poc ?? "unknown",
    vpValue: input.vpState?.value ?? "unknown",
    priceToPoc: priceToPoc(input.auction, input.orderflow),
    targetMovesTowardPoc: side === "none" ? false : targetMovesTowardPoc(input, side),
    evidence: {
      absorption: input.orderflow.evidence?.absorption ?? "unknown",
      print: input.orderflow.evidence?.print ?? "unknown",
      followThrough: input.orderflow.evidence?.followThrough ?? "unknown",
      largestTradeSideMatchesAbsorbedSide: absorbedSide !== "none" && input.orderflow.largestTrade?.side === absorbedSide,
    },
  };
}

export function absorptionPolicyAllowsReclaim(
  quality: ReaderAbsorptionQuality | undefined,
  policy: ReaderAbsorptionPolicy = "strict-trap",
): boolean {
  if (!quality || quality.side === "none") return false;
  if (policy === "raw-edge") return true;
  if (quality.quality === "churn") return false;
  if (policy === "no-rotation-only") return quality.quality === "no-rotation";
  if (policy === "block-continuation-risk" || policy === "require-vp-not-against") {
    return quality.quality !== "continuation-risk";
  }
  if (policy === "require-stalled") return quality.evidence.followThrough === "stalled";
  if (policy === "require-local-standout") return quality.evidence.print === "local-standout";
  if (policy === "require-attacker-print") return quality.evidence.largestTradeSideMatchesAbsorbedSide;
  if (policy === "require-toward-poc") return quality.targetMovesTowardPoc;
  if (policy === "require-stalled-attacker-print") {
    return quality.evidence.followThrough === "stalled"
      && quality.evidence.largestTradeSideMatchesAbsorbedSide;
  }
  if (policy === "require-stalled-toward-poc") {
    return quality.evidence.followThrough === "stalled"
      && quality.targetMovesTowardPoc;
  }
  return quality.quality === "trap-confirmed";
}

function reversalSideFor(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
}): Side | "none" {
  if (
    input.auction.level?.kind === "support"
    && input.auction.location === "value-low"
    && input.orderflow.events.includes("sell-absorption")
  ) {
    return "long";
  }
  if (
    input.auction.level?.kind === "resistance"
    && input.auction.location === "value-high"
    && input.orderflow.events.includes("buy-absorption")
  ) {
    return "short";
  }
  return "none";
}

function isChurn(input: {
  auction: AuctionRead;
  auctionMode?: ReaderAuctionMode;
  vpState?: ReaderVpState;
}): boolean {
  return input.auction.location === "near-poc"
    || input.vpState?.auction === "poc-chop"
    || input.auctionMode?.mode === "poc-gravity";
}

function trapBlockers(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
}, side: Side, absorbedSide: "buy" | "sell"): string[] {
  const evidence = input.orderflow.evidence;
  const blockers: string[] = [];
  if (evidence?.absorption !== "confirmed") blockers.push("absorption has not reached confirmed evidence");
  if (evidence?.followThrough !== "stalled") blockers.push("attacking flow has not stalled after absorption");
  if (evidence?.print !== "local-standout") blockers.push("absorbed print is not locally significant");
  if (input.orderflow.largestTrade?.side !== absorbedSide) blockers.push("largest print is not from the absorbed attacking side");
  if (!targetMovesTowardPoc(input, side)) blockers.push("entry path is not rotating toward POC");
  return blockers;
}

function vpMigratesAgainstFade(input: {
  vpState?: ReaderVpState;
}, side: Side): boolean {
  if (!input.vpState) return false;
  if (side === "short") {
    return input.vpState.poc === "poc-migrating-up" || input.vpState.value === "value-expanding-up";
  }
  return input.vpState.poc === "poc-migrating-down" || input.vpState.value === "value-expanding-down";
}

function targetMovesTowardPoc(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
}, side: Side): boolean {
  const profile = input.auction.profile;
  const price = input.orderflow.lastPrice;
  if (!profile || price === null) return false;
  if (side === "long") return price < profile.poc;
  return price > profile.poc;
}

function priceToPoc(auction: AuctionRead, orderflow: OrderflowRead): ReaderAbsorptionQuality["priceToPoc"] {
  const poc = auction.profile?.poc;
  const price = orderflow.lastPrice;
  if (poc === undefined || price === null) return "no-poc";
  if (price < poc) return "below-poc";
  if (price > poc) return "above-poc";
  return "at-poc";
}



