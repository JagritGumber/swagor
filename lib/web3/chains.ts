import { defineChain } from "viem";

/**
 * Arc Testnet (Circle's L1 for stablecoin finance).
 * USDC is the native gas token (18 decimals for EVM compatibility — on-chain
 * USDC at the system contract uses 6 decimals like elsewhere).
 *
 * Source: https://docs.arc.network/arc/references/connect-to-arc
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "Arc Testnet Explorer",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});
