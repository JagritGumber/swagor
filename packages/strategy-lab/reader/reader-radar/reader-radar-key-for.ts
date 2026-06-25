import type { ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";

export function readerRadarKeyFor(candidate: ReaderCandidateDraft): string {
  return [
    candidate.asset,
    candidate.family,
    candidate.side ?? "none",
    candidate.reader.auctionLocation,
    candidate.reader.auctionLevelKind ?? "none",
    candidate.reader.narrativeIntent ?? "none",
    orderflowKeyFor(candidate),
    setupFamilyKeyFor(candidate),
  ].join("|");
}

function setupFamilyKeyFor(candidate: ReaderCandidateDraft): string {
  if (candidate.family === "trend-continuation" && candidate.reader.narrativeIntent === "continuation-pullback") {
    return "continuation-pullback";
  }
  return candidate.builder.setupFamily ?? "none";
}

function orderflowKeyFor(candidate: ReaderCandidateDraft): string {
  if (candidate.family === "trend-continuation" && candidate.reader.narrativeIntent === "continuation-pullback") {
    return "forming-continuation";
  }
  return orderflowEventFamily(candidate.orderflow.events);
}

function orderflowEventFamily(events: string[]): string {
  const family: string[] = [];
  if (events.includes("confirmed-absorption")) family.push("confirmed-absorption");
  if (events.includes("buy-absorption")) family.push("buy-absorption");
  if (events.includes("sell-absorption")) family.push("sell-absorption");
  if (events.includes("stalled-buying")) family.push("stalled-buying");
  if (events.includes("stalled-selling")) family.push("stalled-selling");
  if (events.includes("large-print")) family.push("large-print");
  return family.length === 0 ? "no-event" : family.join("+");
}



