import type { AuctionRead } from "@strategy-lab/read-core/read/types";
import type { OrderflowRead } from "@strategy-lab/read-core/orderflow/types";
import type { Candle, Side } from "@strategy-lab/types";
import { absorptionPolicyAllowsReclaim } from "../reader-absorption-quality/read-reader-absorption-quality";
import type { ReaderAbsorptionPolicy, ReaderAbsorptionQuality } from "../reader-absorption-quality/types";
import { readerRejectionEdgeFor } from "../reader-live/reader-rejection-edge-for";
import type { ReaderVpState } from "../reader-vp-state/types";
import type { ReaderNarrative, ReaderNarrativeLevelStory, ReaderNarrativeParticipation } from "./types";

export function readReaderNarrative(input: {
  auction: AuctionRead;
  orderflow: OrderflowRead;
  lastClosedCandle: Candle | null;
  absorptionQuality?: ReaderAbsorptionQuality;
  absorptionPolicy?: ReaderAbsorptionPolicy;
  vpState?: ReaderVpState;
}): ReaderNarrative {
  const base = baseNarrative(input.auction, input.orderflow);
  if (base) return base;

  const participation = participationFor(input.orderflow);
  const levelStory = levelStoryFor(input.auction, input.orderflow, input.lastClosedCandle);
  const trend = trendNarrative(input.auction, input.orderflow, participation, levelStory, input.vpState);
  if (trend) return trend;

  const rejection = rejectionNarrative(
    input.auction,
    input.orderflow,
    participation,
    levelStory,
    input.absorptionQuality,
    input.absorptionPolicy,
  );
  if (rejection) return rejection;

  const breakout = breakoutNarrative(input.auction, input.orderflow, participation, levelStory);
  if (breakout) return breakout;

  return {
    intent: "wait",
    direction: "none",
    participation,
    levelStory,
    reasons: [
      `${input.auction.location} does not have a complete initiative or rejection story`,
      input.orderflow.narrative,
    ],
    invalidation: null,
    target: null,
  };
}

function trendNarrative(
  auction: AuctionRead,
  orderflow: OrderflowRead,
  participation: ReaderNarrativeParticipation,
  levelStory: ReaderNarrativeLevelStory,
  vpState: ReaderVpState | undefined,
): ReaderNarrative | null {
  if (
    auction.level?.kind === "resistance"
    && auction.location === "above-value"
    && vpState?.auction === "accepting-above-value"
    && levelStory === "accepting-above"
    && participation === "initiative-buying"
  ) {
    return trendRead("long", participation, levelStory, auction, orderflow, [
      "buyers are accepting above value while VP migrates higher",
      "trend continuation follows accepted value migration",
    ]);
  }
  if (
    auction.level?.kind === "support"
    && auction.location === "below-value"
    && vpState?.auction === "accepting-below-value"
    && levelStory === "accepting-below"
    && participation === "initiative-selling"
  ) {
    return trendRead("short", participation, levelStory, auction, orderflow, [
      "sellers are accepting below value while VP migrates lower",
      "trend continuation follows accepted value migration",
    ]);
  }
  if (
    auction.level?.kind === "support"
    && auction.location === "value-low"
    && vpState?.poc === "poc-migrating-up"
    && vpState.value !== "value-expanding-up"
    && orderflow.pressure === "buy-pressure"
  ) {
    return {
      intent: "continuation-pullback",
      direction: "long",
      participation,
      levelStory,
      reasons: [
        "value is migrating up and buyers reclaimed the lower value edge",
        "trend continuation pullback follows value migration instead of fading it",
        orderflow.narrative,
      ],
      invalidation: auction.invalidation,
      target: auction.target,
    };
  }
  if (
    auction.level?.kind === "resistance"
    && auction.location === "value-high"
    && vpState?.poc === "poc-migrating-down"
    && vpState.value !== "value-expanding-down"
    && orderflow.pressure === "sell-pressure"
  ) {
    return {
      intent: "continuation-pullback",
      direction: "short",
      participation,
      levelStory,
      reasons: [
        "value is migrating down and sellers reclaimed the upper value edge",
        "trend continuation pullback follows value migration instead of fading it",
        orderflow.narrative,
      ],
      invalidation: auction.invalidation,
      target: auction.target,
    };
  }
  return null;
}

function trendRead(
  direction: Side,
  participation: ReaderNarrativeParticipation,
  levelStory: ReaderNarrativeLevelStory,
  auction: AuctionRead,
  orderflow: OrderflowRead,
  reasons: string[],
): ReaderNarrative {
  return {
    intent: "trend-continuation",
    direction,
    participation,
    levelStory,
    reasons: [...reasons, orderflow.narrative],
    invalidation: auction.invalidation,
    target: auction.target,
  };
}

function baseNarrative(auction: AuctionRead, orderflow: OrderflowRead): ReaderNarrative | null {
  if (!auction.level) {
    return waitNarrative("auction has no active support/resistance level", auction, orderflow, "no-level");
  }
  if (!auction.profile) {
    return waitNarrative("auction has no local volume profile", auction, orderflow, "no-level");
  }
  if (orderflow.lastPrice === null) {
    return waitNarrative("orderflow has no last traded price", auction, orderflow, "no-level");
  }
  if (auction.location === "near-poc") {
    return waitNarrative("price is balanced around local POC", auction, orderflow, "inside-value");
  }
  if (auction.location === "outside-profile") {
    return waitNarrative("price is outside the active profile", auction, orderflow, "no-level");
  }
  return null;
}

function waitNarrative(
  reason: string,
  auction: AuctionRead,
  orderflow: OrderflowRead,
  levelStory: ReaderNarrativeLevelStory,
): ReaderNarrative {
  return {
    intent: "wait",
    direction: "none",
    participation: participationFor(orderflow),
    levelStory,
    reasons: [reason, auction.narrative, orderflow.narrative],
    invalidation: null,
    target: null,
  };
}

function rejectionNarrative(
  auction: AuctionRead,
  orderflow: OrderflowRead,
  participation: ReaderNarrativeParticipation,
  levelStory: ReaderNarrativeLevelStory,
  absorptionQuality: ReaderAbsorptionQuality | undefined,
  absorptionPolicy: ReaderAbsorptionPolicy | undefined,
): ReaderNarrative | null {
  const edge = readerRejectionEdgeFor(auction);
  if (!edge) return null;
  if (
    edge.side === "long"
    && auction.location === "value-low"
    && levelStory === "rejecting-below"
    && orderflow.events.includes("sell-absorption")
  ) {
    if (!absorptionPolicyAllowsReclaim(absorptionQuality, absorptionPolicy)) {
      return waitNarrative(absorptionWaitReason(absorptionQuality, absorptionPolicy), auction, orderflow, levelStory);
    }
    return {
      intent: "reversal-reclaim",
      direction: "long",
      participation,
      levelStory,
      reasons: [
        "sellers pressed into support and failed",
        "support reclaim is the only allowed long idea",
        orderflow.narrative,
      ],
      invalidation: auction.invalidation,
      target: auction.target,
    };
  }
  if (
    edge.side === "short"
    && auction.location === "value-high"
    && levelStory === "rejecting-above"
    && orderflow.events.includes("buy-absorption")
  ) {
    if (!absorptionPolicyAllowsReclaim(absorptionQuality, absorptionPolicy)) {
      return waitNarrative(absorptionWaitReason(absorptionQuality, absorptionPolicy), auction, orderflow, levelStory);
    }
    return {
      intent: "reversal-reclaim",
      direction: "short",
      participation,
      levelStory,
      reasons: [
        "buyers pressed into resistance and failed",
        "resistance rejection is the only allowed short idea",
        orderflow.narrative,
      ],
      invalidation: auction.invalidation,
      target: auction.target,
    };
  }
  if (edge.side === "long" && orderflow.pressure === "sell-pressure") {
    return watchNarrative("reversal-watch", "long", participation, levelStory, [
      "sellers are pressing support but failure is not visible yet",
      orderflow.narrative,
    ], auction);
  }
  if (edge.side === "short" && orderflow.pressure === "buy-pressure") {
    return watchNarrative("reversal-watch", "short", participation, levelStory, [
      "buyers are pressing resistance but failure is not visible yet",
      orderflow.narrative,
    ], auction);
  }
  return null;
}

function absorptionWaitReason(
  absorptionQuality: ReaderAbsorptionQuality | undefined,
  absorptionPolicy: ReaderAbsorptionPolicy | undefined,
): string {
  if (!absorptionQuality) return "absorption has no quality read yet";
  return `absorption policy ${absorptionPolicy ?? "strict-trap"} rejects ${absorptionQuality.quality}: ${absorptionQuality.reasons.join("; ")}`;
}

function breakoutNarrative(
  auction: AuctionRead,
  orderflow: OrderflowRead,
  participation: ReaderNarrativeParticipation,
  levelStory: ReaderNarrativeLevelStory,
): ReaderNarrative | null {
  if (auction.level?.kind === "resistance") {
    if (auction.location === "above-value" && levelStory === "accepting-above" && participation === "initiative-buying") {
      return {
        intent: "breakout-continuation",
        direction: "long",
        participation,
        levelStory,
        reasons: [
          "buyers are accepting above resistance",
          "breakout continuation is allowed only because participation agrees",
          orderflow.narrative,
        ],
        invalidation: auction.invalidation,
        target: auction.target,
      };
    }
    if (auction.location === "value-high" && orderflow.pressure === "buy-pressure") {
      return watchNarrative("breakout-watch", "long", participation, levelStory, [
        "buyers are pressing resistance but acceptance above the level is not proven",
        orderflow.narrative,
      ], auction);
    }
  }

  if (auction.level?.kind === "support") {
    if (auction.location === "below-value" && levelStory === "accepting-below" && participation === "initiative-selling") {
      return {
        intent: "breakout-continuation",
        direction: "short",
        participation,
        levelStory,
        reasons: [
          "sellers are accepting below support",
          "breakdown continuation is allowed only because participation agrees",
          orderflow.narrative,
        ],
        invalidation: auction.invalidation,
        target: auction.target,
      };
    }
    if (auction.location === "value-low" && orderflow.pressure === "sell-pressure") {
      return watchNarrative("breakout-watch", "short", participation, levelStory, [
        "sellers are pressing support but acceptance below the level is not proven",
        orderflow.narrative,
      ], auction);
    }
  }

  return null;
}

function watchNarrative(
  intent: "breakout-watch" | "reversal-watch",
  direction: Side,
  participation: ReaderNarrativeParticipation,
  levelStory: ReaderNarrativeLevelStory,
  reasons: string[],
  auction: AuctionRead,
): ReaderNarrative {
  return {
    intent,
    direction,
    participation,
    levelStory,
    reasons,
    invalidation: auction.invalidation,
    target: auction.target,
  };
}

function levelStoryFor(
  auction: AuctionRead,
  orderflow: OrderflowRead,
  lastClosedCandle: Candle | null,
): ReaderNarrativeLevelStory {
  const level = auction.level;
  if (!level) return "no-level";
  if (auction.location === "near-poc") return "inside-value";

  if (level.kind === "resistance") {
    if (orderflow.events.includes("buy-absorption")) return "rejecting-above";
    if (auction.location === "above-value" && orderflow.pressure === "buy-pressure") {
      return "accepting-above";
    }
  }

  if (level.kind === "support") {
    if (orderflow.events.includes("sell-absorption")) return "rejecting-below";
    if (auction.location === "below-value" && orderflow.pressure === "sell-pressure") {
      return "accepting-below";
    }
  }

  if (auction.location === "value-high" || auction.location === "above-value") return "accepting-above";
  if (auction.location === "value-low" || auction.location === "below-value") return "accepting-below";
  return "no-level";
}

function participationFor(orderflow: OrderflowRead): ReaderNarrativeParticipation {
  if (orderflow.tradeCount === 0) return "drying";
  if (orderflow.events.includes("buy-absorption") || orderflow.events.includes("sell-absorption")) return "absorption";
  if (orderflow.pressure === "buy-pressure") return "initiative-buying";
  if (orderflow.pressure === "sell-pressure") return "initiative-selling";
  if (orderflow.pressure === "balanced") return "balanced";
  return "unknown";
}



