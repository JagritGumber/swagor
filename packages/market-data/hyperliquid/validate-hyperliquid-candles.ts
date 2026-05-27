import { createValidator } from "../../shared";
import type { HyperliquidCandle } from "../shared/types";
import { HyperliquidCandlesSchema } from "./hyperliquid-candle-schema";

const validator = createValidator(HyperliquidCandlesSchema, "Hyperliquid candles");

export function validateHyperliquidCandles(value: unknown): HyperliquidCandle[] {
  return validator.parse(value);
}
