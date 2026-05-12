"use client";

import { useCallback, useEffect, useState } from "react";

type Tick = {
  id: string;
  verdict: "hold" | "escalate";
  rationale: string;
  nextCheckSeconds: number;
  watching: string[];
  createdAt: string;
};

type RecentResponse = {
  ticks: Tick[];
  nextWatcherAt: string | null;
  currentlyWatching: string[] | null;
};

/**
 * Dev-mode watcher strip. Live list of recent ticks plus a Force tick button.
 * Visible only when the page renders with ?dev=1.
 */
export function WatchingStripDev() {
  const [data, setData] = useState<RecentResponse | null>(null);
  const [forcing, setForcing] = useState(false);

  const pull = useCallback(async () => {
    try {
      const res = await fetch("/api/watcher/recent?limit=10", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { pull(); const id = setInterval(pull, 5_000); return () => clearInterval(id); }, [pull]);

  async function forceTick() {
    if (forcing) return;
    setForcing(true);
    try {
      await fetch("/api/watcher/tick", { method: "POST" });
      await pull();
    } finally { setForcing(false); }
  }

  return (
    <section className="border border-[var(--neon-cyan)]/40 bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Watching <span className="font-mono text-xs text-[var(--neon-cyan)]">[dev]</span>
        </h2>
        <button
          type="button"
          onClick={forceTick}
          disabled={forcing}
          className="inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          {forcing ? "Ticking..." : "Force tick"}
        </button>
      </div>

      {!data || data.ticks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No watcher activity yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {data.ticks.map((t) => (
            <div key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3">
              <span className={`font-mono text-xs font-bold uppercase tracking-[0.14em] ${t.verdict === "escalate" ? "text-[var(--neon-cyan)]" : "text-muted-foreground"}`}>
                {t.verdict}
              </span>
              <span className="text-sm text-foreground">{t.rationale}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                next {t.nextCheckSeconds}s · {new Date(t.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
