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
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Your wallet
        </h2>
        {isConnected && address ? (
          <div className="flex items-center gap-3">
            <code className="font-mono text-base text-[var(--neon-cyan)]" title={address}>
              {truncate(address)}
            </code>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {chain?.name ?? "Unknown"}
            </span>
          </div>
        ) : (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                type="button"
                onClick={show}
                className="cta-glow inline-flex h-10 items-center justify-center border border-[var(--hairline-strong)] bg-black px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
              >
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        )}
      </div>
    </section>
  );
}
