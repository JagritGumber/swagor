"use client";

import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * The user's optional external wallet. Pairs with SolonWalletCard inside the
 * dashboard's split row, so this renders without its own border.
 */
export function ConnectedWalletCard() {
  const { address, isConnected, chain } = useAccount();

  return (
    <section className="bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Your wallet
      </h2>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Optional. Connect for live-mode deposits and withdrawals (later).
      </p>
      <div className="mt-5">
        {isConnected && address ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
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
