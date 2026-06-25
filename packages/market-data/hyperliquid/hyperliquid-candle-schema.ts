import { Type } from "@sinclair/typebox";

export const HyperliquidCandleSchema = Type.Object({
  t: Type.Number(),
  T: Type.Number(),
  s: Type.String(),
  i: Type.String(),
  o: Type.String(),
  c: Type.String(),
  h: Type.String(),
  l: Type.String(),
  v: Type.String(),
  n: Type.Number(),
}, { additionalProperties: true });

export const HyperliquidCandlesSchema = Type.Array(HyperliquidCandleSchema);

