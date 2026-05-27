import type { OrderflowWindow } from "./types";

export function createOrderflowWindow(windowMs: number): OrderflowWindow {
  return {
    windowMs,
    trades: [],
    bbo: null,
  };
}
