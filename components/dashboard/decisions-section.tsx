"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Cycle = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

/**
 * Decisions: discrete moments Solon actually acted (the watcher escalated and
 * the full panel ran). No cron ticks. No hold-verdicts. Just decisions.
 * Click a row to open the cycle trace page with the full panel deliberation.
 */
export function DecisionsSection({ walletAddress }: { walletAddress: string }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const fetchCycles = useCallback(async () => {
    const res = await fetch(`/api/cycles?walletAddress=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setCycles(data.cycles ?? []);
    }
  }, [walletAddress]);

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  return (
    <section className="border border-[var(--hairline)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Decisions
      </h2>

      {cycles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing yet. Solon will land a decision here when it sees something worth doing.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>Decision</span><span>Status</span><span>When</span>
          </div>
          {cycles.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/cycles/${c.id}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 transition-colors hover:bg-[#080808]"
            >
              <div className="inline-flex items-center gap-2 font-mono text-sm text-[var(--neon-cyan)]">
                {c.id.slice(0, 8)}
                <ArrowRight aria-hidden className="h-3 w-3 opacity-60" />
              </div>
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">{c.status}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(c.startedAt).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
