"use client";

import { useState } from "react";
import { SwarmCycleTrace } from "./swarm-cycle-trace";

type CycleRow = {
  id: string;
  triggeredBy: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export function SwarmDevPanel() {
  const [open, setOpen] = useState(false);
  const [cycles, setCycles] = useState<CycleRow[] | null>(null);
  const [activeCycle, setActiveCycle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCycles() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/swarm/cycles/today", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { cycles: CycleRow[] };
      setCycles(body.cycles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !cycles) void loadCycles();
  }

  return (
    <section className="border border-[var(--hairline-strong)] bg-black">
      <header className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Admin · swarm dev panel</h2>
        <button onClick={toggle} className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground hover:text-[var(--neon-cyan)]">
          {open ? "hide" : "inspect cycles"}
        </button>
      </header>
      {open && (
        <div className="p-4">
          {loading && <p className="font-mono text-xs text-muted-foreground">loading cycles...</p>}
          {error && <p className="font-mono text-xs text-[var(--neon-red)]">{error}</p>}
          {cycles && cycles.length === 0 && <p className="font-mono text-xs text-muted-foreground">No cycles today yet.</p>}
          {cycles && cycles.length > 0 && (
            <ul className="space-y-1">
              {cycles.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveCycle(c.id === activeCycle ? null : c.id)}
                    className="flex w-full items-center justify-between gap-4 border border-[var(--hairline)] px-3 py-2 text-left hover:border-[var(--neon-cyan)]"
                  >
                    <span className="font-mono text-[11px] text-foreground">{c.id.slice(0, 8)}</span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">{c.triggeredBy ?? "?"}</span>
                    <span className={`font-mono text-[10px] uppercase ${c.status === "failed" ? "text-[var(--neon-red)]" : c.status === "completed" ? "text-[var(--neon-green)]" : "text-[var(--neon-cyan)]"}`}>{c.status}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{new Date(c.startedAt).toLocaleTimeString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {activeCycle && <SwarmCycleTrace cycleId={activeCycle} onClose={() => setActiveCycle(null)} />}
        </div>
      )}
    </section>
  );
}
