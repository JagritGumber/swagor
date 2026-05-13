"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Cycle = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

/**
 * Decisions list. Renders only when there is at least one cycle to show.
 * Click a row to open the cycle trace with the full panel deliberation.
 */
export function DecisionsSection({ walletAddress }: { walletAddress: string }) {
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
        const res = await fetch(`/api/cycles?walletAddress=${walletAddress}`, {
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
  }, [walletAddress]);

  if (!loaded || cycles.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Decisions
      </h2>
      <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline-strong)]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Decision</span><span>Status</span><span>When</span>
        </div>
        {cycles.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/cycles/${c.id}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 transition-colors hover:bg-[#080808]"
          >
            <span className="inline-flex items-center gap-2 font-mono text-sm text-[var(--neon-cyan)]">
              {c.id.slice(0, 8)}
              <ArrowRight aria-hidden className="h-3 w-3 opacity-60" />
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">{c.status}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(c.startedAt).toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
