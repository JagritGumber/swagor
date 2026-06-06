import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderResultUpdate } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { Side } from "../types";
import type {
  ReaderCandidate,
  ReaderCandidateBuilderResponse,
  ReaderCandidateFamily,
} from "./types";

export type ReaderCandidateDraft = Omit<ReaderCandidate, "index" | "outcome">;

export function readReaderCandidate(input: {
  observedAt: number;
  setup: ReaderSetupResult;
  resultUpdate: ReaderResultUpdate | null;
}): ReaderCandidateDraft | null {
  const read = input.setup.read;
  const family = familyFor(read, input.setup);
  if (!family) return null;
  const side = sideFor(read, input.setup, family);
  const entryPrice = read.orderflow.lastPrice;
  const geometry = geometryFor(read, input.setup, side);
  if (!isRecordableCandidate({ family, side, entryPrice, geometry })) return null;
  const response = input.resultUpdate ? builderResponseFor(input.setup, input.resultUpdate) : input.setup.plan.status;

  return {
    asset: read.asset,
    observedAt: input.observedAt,
    family,
    side,
    entryPrice,
    target: geometry.target,
    invalidation: geometry.invalidation,
    reader: {
      auctionLocation: read.auction.location,
      auctionLevelKind: read.auction.level?.kind ?? null,
      auctionMode: read.auctionMode?.mode ?? null,
      auctionPhase: read.auctionMode?.phase ?? null,
      vpAuction: read.vpState?.auction ?? null,
      vpPoc: read.vpState?.poc ?? null,
      vpValue: read.vpState?.value ?? null,
      regime: read.regime?.mode ?? null,
      narrativeIntent: read.narrativeRead?.intent ?? null,
      narrativeDirection: read.narrativeRead?.direction ?? null,
    },
    orderflow: {
      pressure: read.orderflow.pressure,
      events: read.orderflow.events,
      tradeCount: read.orderflow.tradeCount,
      largestTradeSide: read.orderflow.largestTrade?.side ?? null,
    },
    builder: {
      response,
      setupFamily: input.setup.plan.setupFamily ?? null,
      reasons: input.setup.plan.reasons,
    },
  };
}

function isRecordableCandidate(input: {
  family: ReaderCandidateFamily;
  side: Side | null;
  entryPrice: number | null;
  geometry: { target: number | null; invalidation: number | null };
}): boolean {
  if (input.family === "poc-chop-no-trade" && input.side === null) return true;
  if (!input.side || input.entryPrice === null || input.geometry.target === null || input.geometry.invalidation === null) {
    return false;
  }
  return isTradeableGeometry({
    side: input.side,
    entryPrice: input.entryPrice,
    target: input.geometry.target,
    invalidation: input.geometry.invalidation,
  });
}

function familyFor(read: LiveReaderRead, setup: ReaderSetupResult): ReaderCandidateFamily | null {
  if (read.auction.location === "near-poc") return "poc-chop-no-trade";
  if (read.narrativeRead?.intent === "breakout-continuation") return "initiative-continuation";
  if (read.orderflow.events.some((event) => event.includes("absorption"))) return "absorption-reaction";
  if (read.auction.location === "value-high") return "value-high-reaction";
  if (read.auction.location === "value-low") return "value-low-reaction";
  if (setup.plan.status !== "no-trade" && setup.plan.setupFamily === "breakout-acceptance") return "initiative-continuation";
  return null;
}

function sideFor(
  read: LiveReaderRead,
  setup: ReaderSetupResult,
  family: ReaderCandidateFamily,
): Side | null {
  if (setup.plan.status !== "no-trade") return setup.plan.side;
  if (read.narrativeRead?.direction === "long" || read.narrativeRead?.direction === "short") return read.narrativeRead.direction;
  if (family === "value-high-reaction") return "short";
  if (family === "value-low-reaction") return "long";
  if (family === "absorption-reaction") {
    if (read.orderflow.pressure === "buy-pressure") return "short";
    if (read.orderflow.pressure === "sell-pressure") return "long";
  }
  return null;
}

function geometryFor(
  read: LiveReaderRead,
  setup: ReaderSetupResult,
  side: Side | null,
): { target: number | null; invalidation: number | null } {
  if (setup.plan.status !== "no-trade") {
    return {
      target: setup.plan.target,
      invalidation: setup.plan.stop,
    };
  }
  if (!side || !read.auction.profile || !read.auction.level) return { target: null, invalidation: null };
  const profile = read.auction.profile;
  if (side === "long") {
    return {
      target: profile.poc > read.auction.level.price ? profile.poc : profile.valueAreaHigh,
      invalidation: read.auction.level.price,
    };
  }
  return {
    target: profile.poc < read.auction.level.price ? profile.poc : profile.valueAreaLow,
    invalidation: read.auction.level.price,
  };
}

function isTradeableGeometry(input: {
  side: Side;
  entryPrice: number;
  target: number;
  invalidation: number;
}): boolean {
  return signedMove(input.side, input.entryPrice, input.target) > 0
    && signedMove(input.side, input.invalidation, input.entryPrice) > 0;
}

function builderResponseFor(
  setup: ReaderSetupResult,
  resultUpdate: ReaderResultUpdate,
): ReaderCandidateBuilderResponse {
  if (resultUpdate.opened) return "executed";
  return setup.plan.status;
}

function signedMove(side: Side, entry: number, price: number): number {
  return side === "long" ? price - entry : entry - price;
}
