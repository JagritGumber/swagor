"use client";

import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export function ConnectedWalletCard() {
  const { address, isConnected, chain } = useAccount();

  return (
    <div className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-2">Your wallet</h2>
      {isConnected && address ? (
        <div className="space-y-2 text-sm">
          <p title={address}>
            <span className="text-muted-foreground">Address:</span>{" "}
            <code className="text-xs">{truncate(address)}</code>
          </p>
          <p>
            <span className="text-muted-foreground">Network:</span>{" "}
            {chain?.name ?? "Unknown"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a wallet on Arc Testnet to track your real positions.
          </p>
          <ConnectKitButton />
        </div>
      )}
    </div>
  );
}
