"use client";

import { useState } from "react";
import { toast } from "sonner";

const STEP_POLL_MS = 1_500;

async function pollSteps(runId: string): Promise<void> {
  while (true) {
    const res = await fetch("/api/admin/backtest/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    if (!res.ok) throw new Error(`step HTTP ${res.status}`);
    const body = await res.json() as { done: boolean; reason?: string };
    if (body.done) return;
    if (body.reason) toast.error(`Step failure: ${body.reason}`);
    await new Promise((r) => setTimeout(r, STEP_POLL_MS));
  }
}

/**
 * Controls used inside BacktestRunView. `simulate` triggers the trade
 * replay; `abort` stops a stuck run; `resume` flips a failed run back
 * to running and restarts the step poller from this tab so a user
 * who lost their original tab can recover without manual DB work.
 */
export function useBacktestControls(runId: string, onChange: () => Promise<void>) {
  const [simulating, setSimulating] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [resuming, setResuming] = useState(false);

  async function simulate() {
    if (simulating) return;
    setSimulating(true);
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/simulate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { opened: number; closed: number };
      toast.success(`Replay complete. Opened ${body.opened}, closed ${body.closed}.`);
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSimulating(false);
    }
  }

  async function abort() {
    if (aborting) return;
    setAborting(true);
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/abort`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Backtest aborted.");
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAborting(false);
    }
  }

  async function resume() {
    if (resuming) return;
    setResuming(true);
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/resume`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Backtest resumed.");
      await onChange();
      await pollSteps(runId);
      toast.success("Backtest done.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setResuming(false);
    }
  }

  return { simulate, abort, resume, simulating, aborting, resuming };
}
