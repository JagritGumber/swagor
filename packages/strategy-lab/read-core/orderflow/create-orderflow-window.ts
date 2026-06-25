import type { OrderflowWindow } from "./types";

export function createOrderflowWindow(windowMs: number): OrderflowWindow {
  return {
    windowMs,
    trades: [],
    startIndex: 0,
    bbo: null,
    bboHistory: [],
    bboStartIndex: 0,
  };
}

