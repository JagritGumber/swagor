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
 * Dev strip: live watcher activity + two manual triggers. Visible only on
 * `?dev=1`. Force tick runs the watcher for this user bypassing the cron
 * cadence check. Force escalate skips the watcher entirely and creates a
 * cycle directly, useful when the watcher will not escalate on its own.
 */
export function WatchingStripDev() {
  const [data, setData] = useState<RecentResponse | null>(null);
  const [busy, setBusy] = useState<"tick" | "escalate" | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const pull = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch("/api/watcher/recent?limit=10", { cache: "no-store", signal });
      if (res.ok) setData(await res.json());
    } catch { /* swallow (abort or network) */ }
  }, []);

  useEffect(() => {
    let inFlight: AbortController | null = null;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // If a previous fetch is still in flight, abort it before firing the next.
      inFlight?.abort();
      inFlight = new AbortController();
      pull(inFlight.signal);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      inFlight?.abort();
      clearInterval(id);
    };
  }, [pull]);

  async function hit(path: string, key: "tick" | "escalate") {
    if (busy) return;
    setBusy(key); setLastError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        setLastError(body.error ?? `HTTP ${res.status}`);
      }
      await pull();
    } finally { setBusy(null); }
  }

  return (
    <section className="border border-[var(--neon-cyan)]/40 bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Watching <span className="font-mono text-xs text-[var(--neon-cyan)]">[dev]</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => hit("/api/watcher/force-tick", "tick")}
            disabled={!!busy}
            className="inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {busy === "tick" ? "Ticking..." : "Force tick"}
          </button>
          <button
            type="button"
            onClick={() => hit("/api/watcher/force-escalate", "escalate")}
            disabled={!!busy}
            className="inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {busy === "escalate" ? "Firing..." : "Force escalate"}
          </button>
        </div>
      </div>

      {lastError && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">
          {lastError}
        </p>
      )}

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
