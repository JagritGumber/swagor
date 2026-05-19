"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CyclesList } from "./cycles-list";
import { BacktestRunner } from "./backtest-runner";
import { EmailTestButtons } from "@/components/admin/email-test-buttons";

/**
 * Admin dev panel. Hosts the force-run button, the paginated live
 * cycles list, the backtest runner, and the email test buttons.
 * Cycles list owns its own pagination + active-cycle state; this
 * component only triggers a refresh after force-run via a key bump.
 */
export function SwarmDevPanel() {
  const [open, setOpen] = useState(false);
  const [forcing, setForcing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function forceRun() {
    if (forcing) return;
    setForcing(true);
    try {
      const res = await fetch("/api/admin/swarm/daily-plan/force", { method: "POST" });
      const body = await res.json() as { cycleId?: string; status: string; reason?: string };
      if (body.status === "complete") toast.success(`Plan generated. cycle ${body.cycleId?.slice(0, 8) ?? ""}`);
      else if (body.status === "skipped") toast.message(`Skipped: ${body.reason ?? "unknown"}`);
      else toast.error(`${body.status}: ${body.reason ?? "see server logs"}`);
      setRefreshKey((k) => k + 1);
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
          <button onClick={() => setOpen((v) => !v)} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">
            {open ? "hide" : "inspect cycles"}
          </button>
        </div>
      </header>
      {open && <div className="p-4"><CyclesList refreshKey={refreshKey} /></div>}
      {open && <BacktestRunner />}
      {open && <EmailTestButtons />}
    </section>
  );
}
