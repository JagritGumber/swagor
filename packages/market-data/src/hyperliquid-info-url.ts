import type { HyperliquidNetwork } from "./types";

export function hyperliquidInfoUrl(network: HyperliquidNetwork): string {
  if (network === "mainnet") return "https://api.hyperliquid.xyz/info";
  return "https://api.hyperliquid-testnet.xyz/info";
}
