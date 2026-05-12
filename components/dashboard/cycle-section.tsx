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

export function CycleSection({ walletAddress }: { walletAddress: string }) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    const res = await fetch(`/api/cycles?walletAddress=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      setCycles(data.cycles ?? []);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  async function runCycle() {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchCycles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start cycle");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Cycles
        </h2>
        <button
          type="button"
          onClick={runCycle}
          disabled={isRunning}
          className="cta-glow inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "Starting..." : "Run cycle now"}
        </button>
      </div>

      {error && <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}

      {cycles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No cycles yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline-strong)]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>Cycle</span><span>Status</span><span>Started</span>
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
