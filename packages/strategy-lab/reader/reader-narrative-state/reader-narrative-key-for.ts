import type { ReaderNarrativeKeyInput } from "./types";
import { readerSessionFor } from "../reader-session/reader-session-for";

export function readerNarrativeKeyFor(input: ReaderNarrativeKeyInput): string | null {
  const narrative = input.narrative;
  if (!narrative || narrative.direction === "none" || narrative.intent === "wait") return null;
  const session = sessionKeyFor(input);
  return [
    input.asset,
    ...(session ? [session] : []),
    narrative.intent,
    narrative.direction,
    narrative.participation,
    narrative.levelStory,
    input.auction.location,
    input.auction.levelKind ?? "no-level",
  ].join("|");
}

function sessionKeyFor(input: ReaderNarrativeKeyInput): string | null {
  const mode = input.sessionMode ?? "utc-day";
  if (mode === "rolling") return null;
  if (mode === "liquidity-session") return readerSessionFor({ at: input.at, config: input.session }).id;
  return sessionDay(input.at);
}

function sessionDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}



