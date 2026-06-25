import type { OrderflowEvent } from "../../strategy-lab";
import type { BybitTradeRow } from "./parse-bybit-trade-csv";

export function bybitTradeToOrderflowEvent(row: BybitTradeRow): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: row.time,
    trade: {
      asset: row.symbol,
      side: row.side,
      price: row.price,
      size: row.size,
      time: row.time,
      id: row.id,
    },
  };
}


