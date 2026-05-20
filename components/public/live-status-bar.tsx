"use client";

import { useEffect, useState } from "react";
import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

function countdown(target: Date | null): string {
  if (!target) return "soon";
  const s = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Slim live "heartbeat" bar for the public flagship: a pulsing dot, the
 * agent's current state (in position, or honestly FLAT - scanning the
 * watchlist), and a ticking countdown to the next watcher scan. Reuses
 * the same poll as the watching strip; no fabricated state.
 */
export function LiveStatusBar({ username, position }: { username: string; position?: { side: string; asset: string } | null }) {
  const data = useWatcherPoll({ url: `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 1 });
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const watching = data?.currentlyWatching ?? [];
  const nextAt = data?.nextWatcherAt ? new Date(data.nextWatcherAt) : null;
  const state = position
    ? `in position: ${position.side} ${position.asset}`
    : watching.length ? `flat - scanning ${watching.join("/")}` : "initializing";

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-[var(--hairline-strong)] bg-black px-6 py-3 font-mono text-[11px] uppercase tracking-[0.16em]">
      <span className="flex items-center gap-2 text-[var(--neon-green)]">
        <span aria-hidden className="inline-block h-2 w-2 animate-pulse bg-[var(--neon-green)]" />
        {data ? "live" : "connecting"}
      </span>
      <span className={position ? "text-[var(--neon-cyan)]" : "text-foreground"}>{state}</span>
      {nextAt && <span className="text-muted-foreground">next scan in {countdown(nextAt)}</span>}
    </section>
  );
}
