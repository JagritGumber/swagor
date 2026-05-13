"use client";

import { useEffect, useState } from "react";

type RecentResponse = {
  ticks: Array<{ createdAt: string }>;
  currentlyWatching: string[] | null;
};

/**
 * Live "watching X, Y, Z · last check Ns ago" footer for the Solon card.
 * Polls /api/watcher/recent every 30s. Tick-based render keeps the "ago"
 * string fresh.
 */
export function WatchingFooter({ initialWatching }: { initialWatching: string[] }) {
  const [watching, setWatching] = useState<string[]>(initialWatching);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let inFlight: AbortController | null = null;
    let cancelled = false;
    async function pull() {
      if (cancelled) return;
      inFlight?.abort();
      inFlight = new AbortController();
      try {
        const res = await fetch("/api/watcher/recent?limit=1", {
          cache: "no-store",
          signal: inFlight.signal,
        });
        if (!res.ok) return;
        const data: RecentResponse = await res.json();
        if (cancelled) return;
        if (data.currentlyWatching) setWatching(data.currentlyWatching);
        if (data.ticks[0]) setLastCheckAt(data.ticks[0].createdAt);
      } catch { /* swallow (abort or network) */ }
    }
    pull();
    const poll = setInterval(pull, 30_000);
    const re = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => {
      cancelled = true;
      inFlight?.abort();
      clearInterval(poll);
      clearInterval(re);
    };
  }, []);

  const agoLabel = lastCheckAt ? agoString(new Date(lastCheckAt)) : "no checks yet";
  void tick; // re-render driver

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Watching
      </div>
      <div className="font-mono text-sm text-foreground">
        {watching.join(", ")}
      </div>
      <span aria-hidden className="text-muted-foreground">·</span>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        last check {agoLabel}
      </div>
    </div>
  );
}

function agoString(when: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - when.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
