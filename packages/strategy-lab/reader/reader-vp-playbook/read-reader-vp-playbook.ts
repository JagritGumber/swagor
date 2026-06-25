import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { Side } from "../../types";
import type { ReaderVpPlaybook } from "./types";

export function readReaderVpPlaybook(read: LiveReaderRead, narrative: ReaderNarrative | undefined = read.narrativeRead): ReaderVpPlaybook {
  const profile = read.auction.profile;
  const price = read.orderflow.lastPrice;
  const vpState = read.vpState;
  if (!read.auction.level || !profile || price === null) {
    return noTrade("VP playbook needs an active level, profile, and last traded price");
  }

  if (vpState?.auction === "poc-chop" || read.auction.location === "near-poc") {
    return noTrade(vpState?.auction === "poc-chop"
      ? "VP shows POC chop after an edge attempt"
      : "price is at POC/fair value, so the reader waits");
  }

  if (read.auction.location === "outside-profile") {
    return noTrade("price is outside the active profile without a usable VP edge");
  }

  const acceptance = acceptedContinuation(read, narrative);
  if (acceptance) return acceptance;

  const failedBreakout = failedBreakoutFade(read, narrative);
  if (failedBreakout) return failedBreakout;

  const rangeFade = rangeFadeToPoc(read);
  if (rangeFade) return rangeFade;

  return noTrade("VP does not provide a clean fade or continuation playbook");
}

function acceptedContinuation(read: LiveReaderRead, narrative: ReaderNarrative | undefined): ReaderVpPlaybook | null {
  if (
    read.vpState?.auction === "accepting-above-value"
    && read.auction.location === "above-value"
    && read.auction.level?.kind === "resistance"
    && narrative?.levelStory === "accepting-above"
    && narrative.participation === "initiative-buying"
  ) {
    return playbook("accepted-continuation", "long", "VP accepts above value/resistance with initiative buying");
  }
  if (
    read.vpState?.auction === "accepting-below-value"
    && read.auction.location === "below-value"
    && read.auction.level?.kind === "support"
    && narrative?.levelStory === "accepting-below"
    && narrative.participation === "initiative-selling"
  ) {
    return playbook("accepted-continuation", "short", "VP accepts below value/support with initiative selling");
  }
  if (
    read.auction.location === "value-low"
    && read.auction.level?.kind === "support"
    && narrative?.intent === "continuation-pullback"
    && narrative.direction === "long"
    && read.orderflow.pressure === "buy-pressure"
    && read.vpState?.poc === "poc-migrating-up"
    && read.vpState.value !== "value-expanding-up"
  ) {
    return playbook("accepted-continuation", "long", "VP trend context accepts a value-low pullback with buying pressure");
  }
  if (
    read.auction.location === "value-high"
    && read.auction.level?.kind === "resistance"
    && narrative?.intent === "continuation-pullback"
    && narrative.direction === "short"
    && read.orderflow.pressure === "sell-pressure"
    && read.vpState?.poc === "poc-migrating-down"
    && read.vpState.value !== "value-expanding-down"
  ) {
    return playbook("accepted-continuation", "short", "VP trend context accepts a value-high pullback with selling pressure");
  }
  return null;
}

function failedBreakoutFade(read: LiveReaderRead, narrative: ReaderNarrative | undefined): ReaderVpPlaybook | null {
  if (
    read.auction.location === "value-high"
    && read.auction.level?.kind === "resistance"
    && (narrative?.levelStory === "rejecting-above" || read.auctionMode?.mode === "failed-expansion")
    && read.orderflow.events.includes("buy-absorption")
    && targetMovesTowardPoc(read, "short")
    && !vpMigratesAgainstFade(read, "short")
  ) {
    return playbook("failed-breakout-fade-to-poc", "short", "VP rejects above value and target rotates back toward POC");
  }
  if (
    read.auction.location === "value-low"
    && read.auction.level?.kind === "support"
    && (narrative?.levelStory === "rejecting-below" || read.auctionMode?.mode === "failed-expansion")
    && read.orderflow.events.includes("sell-absorption")
    && targetMovesTowardPoc(read, "long")
    && !vpMigratesAgainstFade(read, "long")
  ) {
    return playbook("failed-breakout-fade-to-poc", "long", "VP rejects below value and target rotates back toward POC");
  }
  return null;
}

function rangeFadeToPoc(read: LiveReaderRead): ReaderVpPlaybook | null {
  if (read.auctionMode?.mode !== "balanced-value" && read.auctionMode?.mode !== "poc-gravity") return null;
  if (read.vpState?.value !== "value-stable" && read.vpState?.value !== "value-compressing") return null;
  if (read.auction.location === "value-high" && targetMovesTowardPoc(read, "short")) {
    return playbook("range-fade-to-poc", "short", "balanced VP allows value-high fade toward POC");
  }
  if (read.auction.location === "value-low" && targetMovesTowardPoc(read, "long")) {
    return playbook("range-fade-to-poc", "long", "balanced VP allows value-low fade toward POC");
  }
  return null;
}

function vpMigratesAgainstFade(read: LiveReaderRead, side: Side): boolean {
  if (!read.vpState) return false;
  if (side === "short") {
    return read.vpState.poc === "poc-migrating-up" || read.vpState.value === "value-expanding-up";
  }
  return read.vpState.poc === "poc-migrating-down" || read.vpState.value === "value-expanding-down";
}

function targetMovesTowardPoc(read: LiveReaderRead, side: Side): boolean {
  const profile = read.auction.profile;
  const price = read.orderflow.lastPrice;
  if (!profile || price === null) return false;
  if (side === "long") return price < profile.poc;
  return price > profile.poc;
}

function playbook(kind: ReaderVpPlaybook["kind"], allowedSide: Side, reason: string): ReaderVpPlaybook {
  return { kind, allowedSide, reason };
}

function noTrade(reason: string): ReaderVpPlaybook {
  return { kind: "no-trade", allowedSide: "none", reason };
}



