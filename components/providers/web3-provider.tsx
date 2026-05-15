"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { arcTestnet } from "@/lib/web3/chains";
import { siteUrl } from "@/lib/env";

/**
 * Wagmi + ConnectKit provider mounted at the root layout.
 * Only used by the wallet-verification flow today; the rest of the app
 * is wallet-agnostic and uses Better Auth sessions instead.
 *
 * WalletConnect projectId is optional in dev (some warnings) but required
 * for the WalletConnect modal in production. Get one free at
 * walletconnect.com (Cloud → New Project).
 */
const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Selbo",
    appDescription: "Per-user AI perpetual futures trader on Arc Testnet.",
    appUrl: siteUrl(),
    chains: [arcTestnet],
    transports: { [arcTestnet.id]: http() },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  }),
);

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
