"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { useState } from "react";
import { wagmiConfig } from "@/lib/web3/config";

/**
 * Web3 provider stack. Wraps the app so any component can call wagmi hooks
 * (useAccount, useConnect, useSendTransaction, etc.) and ConnectKit can
 * render its wallet-connect modal anywhere.
 */
export function Web3Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
