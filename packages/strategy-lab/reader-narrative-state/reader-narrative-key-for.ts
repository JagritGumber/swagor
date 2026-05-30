import type { ReaderNarrativeKeyInput } from "./types";

export function readerNarrativeKeyFor(input: ReaderNarrativeKeyInput): string | null {
  const narrative = input.narrative;
  if (!narrative || narrative.direction === "none" || narrative.intent === "wait") return null;
  return [
    input.asset,
    sessionDay(input.at),
    narrative.intent,
    narrative.direction,
    narrative.participation,
    narrative.levelStory,
    input.auction.location,
    input.auction.levelKind ?? "no-level",
  ].join("|");
}

function sessionDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}
