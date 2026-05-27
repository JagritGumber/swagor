import type { OrderflowWindow } from "./types";

export function expireOrderflowWindow(window: OrderflowWindow, now: number): void {
  const minTime = now - window.windowMs;
  while (window.startIndex < window.trades.length && window.trades[window.startIndex].time < minTime) {
    window.startIndex += 1;
  }
  if (window.startIndex > 2048 && window.startIndex > window.trades.length / 2) {
    window.trades.splice(0, window.startIndex);
    window.startIndex = 0;
  }
}
