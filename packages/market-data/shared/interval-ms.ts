import type { CandleInterval } from "./types";

export function intervalMs(interval: CandleInterval): number {
  if (interval === "5m") return 300_000;
  return 3_600_000;
}

