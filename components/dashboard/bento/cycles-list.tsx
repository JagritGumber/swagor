"use client";

import { useCallback, useEffect, useState } from "react";
import { SwarmCycleTrace } from "./swarm-cycle-trace";

type CycleRow = {
  id: string;
  triggeredBy: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

const PAGE = 50;

/**
 * Paginated list of LIVE swarm cycles. Backtest cycles are excluded
 * at the API layer; this component only handles cursor pagination and
 * the click-to-inspect interaction. `refreshKey` bump from the parent
 * (e.g. after force-run) resets the list to the first page.
 */
export function CyclesList({ refreshKey }: { refreshKey: number }) {
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const fetchPage = useCallback(async (before: string | null, append: boolean) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE) });
      if (before) qs.set("before", before);
      const res = await fetch(`/api/admin/swarm/cycles?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { cycles: CycleRow[]; nextBefore: string | null };
      setCycles((prev) => append ? [...prev, ...body.cycles] : body.cycles);
      setNextBefore(body.nextBefore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPage(null, false); }, [fetchPage, refreshKey]);

  return (
    <div className="space-y-2">
      {error && <p className="font-mono text-xs text-[var(--neon-red)]">{error}</p>}
      {cycles.length === 0 && !loading && !error && (
        <p className="font-mono text-xs text-muted-foreground">No live cycles.</p>
      )}
      {cycles.length > 0 && (
        <ul className="space-y-1">
          {cycles.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActive(c.id === active ? null : c.id)}
                className="flex w-full items-center justify-between gap-4 border border-[var(--neon-green)]/30 px-3 py-2 text-left hover:border-[var(--neon-green)]"
              >
                <span className="font-mono text-[11px] text-foreground">{c.id.slice(0, 8)}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">{c.triggeredBy ?? "?"}</span>
                <span className={`font-mono text-[10px] uppercase ${c.status === "failed" ? "text-[var(--neon-red)]" : c.status === "completed" ? "text-[var(--neon-green)]" : "text-[var(--neon-cyan)]"}`}>{c.status}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(c.startedAt).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {nextBefore && (
        <button
          type="button" onClick={() => void fetchPage(nextBefore, true)} disabled={loading}
          className="border border-[var(--neon-green)]/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60"
        >
          {loading ? "loading..." : "load older"}
        </button>
      )}
      {loading && cycles.length === 0 && <p className="font-mono text-xs text-muted-foreground">loading...</p>}
      {active && <SwarmCycleTrace cycleId={active} onClose={() => setActive(null)} />}
    </div>
  );
}
