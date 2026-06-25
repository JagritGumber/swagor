import type { HyperliquidNetwork } from "../shared/types";

export function hyperliquidWsUrl(network: HyperliquidNetwork): string {
  if (network === "mainnet") return "wss://api.hyperliquid.xyz/ws";
  return "wss://api.hyperliquid-testnet.xyz/ws";
}

