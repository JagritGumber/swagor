import type { ReaderResultEntry, ReaderResultOutcome } from "./types";

export function readerResultForPrice(input: {
  entry: ReaderResultEntry;
  price: number;
  at: number;
}): ReaderResultOutcome | null {
  const risk = Math.abs(input.entry.entryPrice - input.entry.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  if (input.entry.side === "long") {
    if (input.price <= input.entry.stop) return outcome(input.entry, input.entry.stop, input.at, "stop");
    if (input.price >= input.entry.target) return outcome(input.entry, input.entry.target, input.at, "target");
    return null;
  }
  if (input.price >= input.entry.stop) return outcome(input.entry, input.entry.stop, input.at, "stop");
  if (input.price <= input.entry.target) return outcome(input.entry, input.entry.target, input.at, "target");
  return null;
}

function outcome(
  entry: ReaderResultEntry,
  exitPrice: number,
  exitAt: number,
  exitReason: ReaderResultOutcome["exitReason"],
): ReaderResultOutcome {
  const risk = Math.abs(entry.entryPrice - entry.stop);
  const pnl = entry.side === "long" ? exitPrice - entry.entryPrice : entry.entryPrice - exitPrice;
  return {
    ...entry,
    exitPrice,
    exitAt,
    exitReason,
    r: Number((pnl / risk).toFixed(4)),
  };
}


