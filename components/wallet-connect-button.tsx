"use client";

import { ConnectKitButton } from "connectkit";

/**
 * Thin client-component wrapper around ConnectKit's button so it can be
 * placed inside server components (like app/layout.tsx). ConnectKit handles
 * all the wallet-connection state: disconnected -> "Connect Wallet",
 * connected -> truncated address with chain badge.
 */
export function WalletConnectButton() {
  return <ConnectKitButton />;
}
