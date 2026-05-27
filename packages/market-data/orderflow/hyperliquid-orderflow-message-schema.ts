import { Type } from "@sinclair/typebox";

const HyperliquidWsLevelSchema = Type.Object({
  px: Type.String(),
  sz: Type.String(),
  n: Type.Number(),
}, { additionalProperties: true });

const HyperliquidWsTradeSchema = Type.Object({
  coin: Type.String(),
  side: Type.Union([Type.Literal("B"), Type.Literal("A")]),
  px: Type.String(),
  sz: Type.String(),
  hash: Type.String(),
  time: Type.Number(),
  tid: Type.Number(),
  users: Type.Tuple([Type.String(), Type.String()]),
}, { additionalProperties: true });

const HyperliquidWsBboSchema = Type.Object({
  coin: Type.String(),
  time: Type.Number(),
  bbo: Type.Tuple([
    Type.Union([HyperliquidWsLevelSchema, Type.Null()]),
    Type.Union([HyperliquidWsLevelSchema, Type.Null()]),
  ]),
}, { additionalProperties: true });

export const HyperliquidTradesMessageSchema = Type.Object({
  channel: Type.Literal("trades"),
  data: Type.Array(HyperliquidWsTradeSchema),
}, { additionalProperties: true });

export const HyperliquidBboMessageSchema = Type.Object({
  channel: Type.Literal("bbo"),
  data: HyperliquidWsBboSchema,
}, { additionalProperties: true });
