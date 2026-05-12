"use client";

import { useEffect, useState } from "react";
import { ConnectKitButton } from "connectkit";

/**
 * Brutalist wallet button. Custom-rendered via ConnectKitButton.Custom.
 * Fixed min-width so the slot does not jump between "connect wallet" /
 * "connecting..." / "0x...c89f" states.
 */
const BTN_BASE =
  "inline-flex h-9 min-w-[180px] items-center justify-center border bg-black px-4 font-mono text-xs uppercase tracking-[0.18em] transition focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={`${BTN_BASE} border-[var(--hairline)] text-muted-foreground`}
      >
        connect wallet
      </div>
    );
  }

  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, truncatedAddress }) => {
        const label = isConnecting
          ? "connecting..."
          : isConnected && truncatedAddress
            ? truncatedAddress
            : "connect wallet";
        const tone = isConnected
          ? "border-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-black"
          : "border-[var(--hairline-strong)] text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]";
        return (
          <button type="button" onClick={show} className={`${BTN_BASE} ${tone}`}>
            {label}
          </button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
