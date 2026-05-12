"use client";

import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * External wallet panel. Solon's autonomous Circle wallet is separate;
 * this is only for the user's own wallet (positions read, optional approvals).
 */
export function ConnectedWalletCard() {
  const { address, isConnected, chain } = useAccount();

  return (
    <section className="p-6">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Your wallet
      </div>
      {isConnected && address ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Address</div>
            <code className="mt-1 block font-mono text-base text-[var(--neon-cyan)]" title={address}>
              {truncate(address)}
            </code>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Network</div>
            <div className="mt-1 text-base text-foreground">{chain?.name ?? "Unknown"}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect a wallet on Arc Testnet to track your real positions. Solon&apos;s autonomous wallet is separate.
          </p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                type="button"
                onClick={show}
                className="cta-glow inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
              >
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      )}
    </section>
  );
}
