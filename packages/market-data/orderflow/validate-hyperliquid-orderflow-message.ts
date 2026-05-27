import { createValidator } from "../../shared";
import type { HyperliquidWsBbo, HyperliquidWsTrade } from "./types";
import { HyperliquidBboMessageSchema, HyperliquidTradesMessageSchema } from "./hyperliquid-orderflow-message-schema";

const tradesMessageValidator = createValidator(HyperliquidTradesMessageSchema, "Hyperliquid trades message");
const bboMessageValidator = createValidator(HyperliquidBboMessageSchema, "Hyperliquid BBO message");

export function validateHyperliquidTradesData(message: unknown): HyperliquidWsTrade[] | null {
  if (!isChannel(message, "trades")) return null;
  return tradesMessageValidator.parse(message).data;
}

export function validateHyperliquidBboData(message: unknown): HyperliquidWsBbo | null {
  if (!isChannel(message, "bbo")) return null;
  return bboMessageValidator.parse(message).data;
}

function isChannel(value: unknown, channel: string): boolean {
  return typeof value === "object"
    && value !== null
    && "channel" in value
    && (value as { channel?: unknown }).channel === channel;
}
