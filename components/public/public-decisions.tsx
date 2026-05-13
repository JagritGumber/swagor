"use client";

import { useEffect, useState } from "react";

type Cycle = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

/**
 * Public read-only list of a flagship Selbo's recent panel decisions.
 * Drives off /api/selbo/[username]/cycles. Polls every 60s with a
 * visibility check, since decisions only land on rare `deliberate`
 * escalations. Renders nothing until the first response.
 */
export function PublicDecisions({ username }: { username: string }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(tick, 120_000);
        return;
      }
      inFlight?.abort();
      inFlight = new AbortController();
      try {
        const res = await fetch(`/api/selbo/${encodeURIComponent(username)}/cycles`, {
          cache: "no-store",
          signal: inFlight.signal,
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { cycles?: Cycle[] };
          setCycles(data.cycles ?? []);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        if (!cancelled) setLoaded(true);
      }
      if (!cancelled) timer = setTimeout(tick, 60_000);
    }
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [username]);

  if (!loaded || cycles.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Recent decisions
      </h2>
      <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline-strong)]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Decision</span><span>Status</span><span>When</span>
        </div>
        {cycles.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3"
          >
            <span className="font-mono text-sm text-[var(--neon-cyan)]">
              {c.id.slice(0, 8)}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">{c.status}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(c.startedAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
