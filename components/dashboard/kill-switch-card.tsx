"use client";

import { useState } from "react";

/**
 * Kill switch. Persists to solon_instances.kill_switch_active via
 * /api/solon/kill-switch. The watcher cron loop skips killed instances.
 */
export function KillSwitchCard({ initialActive }: { initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !active;
    setPending(true);
    setActive(next); // optimistic
    try {
      const res = await fetch("/api/solon/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActive(!!data.active);
    } catch {
      setActive(!next); // rollback on error
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border border-[var(--hairline)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Kill switch
        </h2>
        <button
          type="button"
          aria-pressed={active}
          onClick={toggle}
          disabled={pending}
          className={`inline-flex h-10 min-w-[120px] items-center justify-center border px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition disabled:opacity-60 ${
            active
              ? "border-[var(--hairline-strong)] bg-black text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
              : "border-[var(--neon-red)] bg-[var(--neon-red)] text-black hover:bg-black hover:text-[var(--neon-red)]"
          }`}
        >
          {active ? "Resume" : "Kill"}
        </button>
      </div>
    </section>
  );
}
