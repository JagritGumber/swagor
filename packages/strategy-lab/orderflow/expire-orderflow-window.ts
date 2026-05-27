import type { OrderflowWindow } from "./types";

export function expireOrderflowWindow(window: OrderflowWindow, now: number): void {
  const minTime = now - window.windowMs;
  let firstLive = 0;
  while (firstLive < window.trades.length && window.trades[firstLive].time < minTime) {
    firstLive += 1;
  }
  if (firstLive > 0) window.trades.splice(0, firstLive);
}
