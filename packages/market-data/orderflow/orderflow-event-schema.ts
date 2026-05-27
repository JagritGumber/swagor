import { Type } from "@sinclair/typebox";

const OrderflowTradeSchema = Type.Object({
  asset: Type.String(),
  side: Type.Union([Type.Literal("buy"), Type.Literal("sell")]),
  price: Type.Number(),
  size: Type.Number(),
  time: Type.Number(),
  id: Type.String(),
}, { additionalProperties: false });

const OrderflowBboSchema = Type.Object({
  asset: Type.String(),
  bidPrice: Type.Union([Type.Number(), Type.Null()]),
  bidSize: Type.Union([Type.Number(), Type.Null()]),
  askPrice: Type.Union([Type.Number(), Type.Null()]),
  askSize: Type.Union([Type.Number(), Type.Null()]),
  time: Type.Number(),
}, { additionalProperties: false });

export const OrderflowEventSchema = Type.Union([
  Type.Object({
    type: Type.Literal("trade"),
    receivedAt: Type.Number(),
    trade: OrderflowTradeSchema,
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal("bbo"),
    receivedAt: Type.Number(),
    bbo: OrderflowBboSchema,
  }, { additionalProperties: false }),
]);

export const StoredOrderflowEventSchema = Type.Object({
  venue: Type.Literal("hyperliquid"),
  network: Type.Union([Type.Literal("mainnet"), Type.Literal("testnet")]),
  asset: Type.String(),
  receivedAt: Type.Number(),
  channel: Type.Union([Type.Literal("trades"), Type.Literal("bbo")]),
  raw: Type.Any(),
  events: Type.Array(OrderflowEventSchema),
}, { additionalProperties: false });
