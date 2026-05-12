"use client";

import { useEffect, useState } from "react";

/**
 * Production-mode watcher indicator. Subtle, single line.
 * Polls /api/watcher/recent every 30s for the freshest watching list and
 * tick timestamp. Never shows individual verdicts — that is dev-mode only.
 */
type RecentResponse = {
  ticks: Array<{ createdAt: string }>;
  nextWatcherAt: string | null;
  currentlyWatching: string[] | null;
};

export function WatchingStatus({ initialWatching }: { initialWatching: string[] }) {
  const [watching, setWatching] = useState<string[]>(initialWatching);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const res = await fetch("/api/watcher/recent?limit=1", { cache: "no-store" });
        if (!res.ok) return;
        const data: RecentResponse = await res.json();
        if (cancelled) return;
        if (data.currentlyWatching) setWatching(data.currentlyWatching);
        if (data.ticks[0]) setLastCheckAt(data.ticks[0].createdAt);
      } catch { /* swallow */ }
    }
    pull();
    const id = setInterval(pull, 30_000);
    const re = setInterval(() => setTick((n) => n + 1), 1_000); // re-render for "ago" string
    return () => { cancelled = true; clearInterval(id); clearInterval(re); };
  }, []);

  const agoLabel = lastCheckAt ? agoString(new Date(lastCheckAt), tick) : "no checks yet";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--neon-green)]" />
        Solon is watching {watching.join(", ")}
      </span>
      <span className="text-[var(--neon-cyan)]">·</span>
      <span>last check {agoLabel}</span>
    </div>
  );
}

function agoString(when: Date, _tick: number): string {
  const s = Math.max(0, Math.floor((Date.now() - when.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
