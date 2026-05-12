"use client";

import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * The user's own external wallet. Optional. Wired for live-mode flows where
 * the user funds Solon's wallet from their own address (later). Empty by
 * default; Connect to populate.
 */
export function ConnectedWalletCard() {
  const { address, isConnected, chain } = useAccount();

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Your wallet
          </h2>
          <p className="mt-2 max-w-md font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Optional. Connect for live-mode deposits and withdrawals (later).
          </p>
        </div>
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
                className="inline-flex h-10 items-center justify-center border border-[var(--hairline-strong)] bg-black px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
              >
                Connect
              </button>
            )}
          </ConnectKitButton.Custom>
        )}
      </div>
    </section>
  );
}
