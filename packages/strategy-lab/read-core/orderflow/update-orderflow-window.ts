import { expireOrderflowWindow } from "./expire-orderflow-window";
import type { OrderflowEvent, OrderflowWindow } from "./types";

export function updateOrderflowWindow(window: OrderflowWindow, event: OrderflowEvent): void {
  if (event.type === "trade") {
    window.trades.push(event.trade);
    expireOrderflowWindow(window, event.trade.time);
    return;
  }
  window.bbo = event.bbo;
  window.bboHistory.push(event.bbo);
  expireOrderflowWindow(window, event.bbo.time);
}

