"use client";

import { ArrowUpRight } from "lucide-react";
import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";
import { Erc8004Badge } from "./erc8004-badge";

const ARCSCAN = "https://testnet.arcscan.app/address/";
const truncate = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

export type FlagshipIdentity = {
  walletAddress: string;
  erc8004TokenId: string | null;
  erc8004RegistrationTxHash: string | null;
  balanceUsd: number;
};

/**
 * Left rail: the live watchlist (symbols Selbo is currently scanning) over a
 * compact identity footer (paper-mode marker, ERC-8004 agent chip, wallet on
 * Arcscan, paper balance). Replaces the old prose header card.
 */
export function FlagshipWatchlist({ username, identity, watching: initial }: { username: string; identity: FlagshipIdentity; watching: string[] }) {
  const data = useWatcherPoll({ url: `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 1 });
  const watching = data?.currentlyWatching ?? initial;

  return (
    <div className="flex h-full flex-col bg-black">
      <header className="shrink-0 border-b border-[var(--hairline-strong)] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Watchlist
      </header>
      <ul className="min-h-0 flex-1 divide-y divide-[var(--hairline)] overflow-y-auto">
        {watching.map((s) => (
          <li key={s} className="flex items-center justify-between px-3 py-2.5 font-mono text-sm tracking-[0.06em] text-foreground">
            <span>{s}</span>
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse bg-[var(--neon-cyan)]" />
          </li>
        ))}
        {watching.length === 0 && (
          <li className="px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">no watchlist yet</li>
        )}
      </ul>
      <footer className="shrink-0 space-y-2 border-t border-[var(--hairline-strong)] px-3 py-3">
        <span className="inline-block border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">paper mode</span>
        <div><Erc8004Badge tokenId={identity.erc8004TokenId} registrationTxHash={identity.erc8004RegistrationTxHash} /></div>
        <a
          href={`${ARCSCAN}${identity.walletAddress}`}
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--neon-cyan)] underline-offset-4 hover:underline"
        >
          {truncate(identity.walletAddress)}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
        </a>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          paper balance <span className="tabular-nums text-foreground/80">${identity.balanceUsd.toFixed(2)}</span>
        </div>
      </footer>
    </div>
  );
}
