"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SwarmCycleTrace } from "./swarm-cycle-trace";
import { BacktestRunner } from "./backtest-runner";
import { EmailTestButtons } from "@/components/admin/email-test-buttons";

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
  const [forcing, setForcing] = useState(false);

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

  async function forceRun() {
    if (forcing) return;
    setForcing(true);
    try {
      const res = await fetch("/api/admin/swarm/daily-plan/force", { method: "POST" });
      const body = await res.json() as { cycleId?: string; status: string; reason?: string };
      if (body.status === "complete") toast.success(`Plan generated. cycle ${body.cycleId?.slice(0, 8) ?? ""}`);
      else if (body.status === "skipped") toast.message(`Skipped: ${body.reason ?? "unknown"}`);
      else toast.error(`${body.status}: ${body.reason ?? "see server logs"}`);
      await loadCycles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setForcing(false);
    }
  }

  return (
    <section className="border border-[var(--neon-green)] bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--neon-green)]/40 px-6 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">Admin · swarm dev panel</h2>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={forceRun} disabled={forcing}
            className="border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60"
          >
            {forcing ? "running..." : "force run daily plan"}
          </button>
          <button onClick={toggle} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">
            {open ? "hide" : "inspect cycles"}
          </button>
        </div>
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
                    className="flex w-full items-center justify-between gap-4 border border-[var(--neon-green)]/30 px-3 py-2 text-left hover:border-[var(--neon-green)]"
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
      {open && <BacktestRunner />}
      {open && <EmailTestButtons />}
    </section>
  );
}
