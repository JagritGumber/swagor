import type { ReaderCandidateDraft } from "../reader-candidates/read-reader-candidate";

export function readerRadarKeyFor(candidate: ReaderCandidateDraft): string {
  return [
    candidate.asset,
    candidate.family,
    candidate.side ?? "none",
    candidate.reader.auctionLocation,
    candidate.reader.auctionLevelKind ?? "none",
    candidate.builder.setupFamily ?? "none",
  ].join("|");
}
